import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ROOT_PAGE_ID = process.env.NOTION_PAGE_ID;

if (!NOTION_TOKEN || !ROOT_PAGE_ID) {
  logger.error("Missing critical environment variables. Ensure NOTION_TOKEN and NOTION_PAGE_ID are set.");
  process.exit(1);
}

// For app tokens (ntn_), we need to use fetch directly with proper headers
// because the Notion SDK might not handle them correctly
const notion = new Client({ 
  auth: NOTION_TOKEN,
  notionVersion: '2022-06-28'
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiCallWithRetry(apiFn, name = 'API Call') {
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      return await apiFn();
    } catch (error) {
      attempts++;
      logger.error(`API call failed (attempt ${attempts}/${maxAttempts}):`, error.message || error);
      if (error.status === 429 || error.code === 'rate_limited') {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '2', 10);
        logger.warn(`${name} hit a rate limit. Retrying after ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Exceeded maximum retry attempts for ${name}.`);
}

export class NotionCrawler {
  constructor() {
    this.visitedNodes = new Map();
    this.manifest = {
      rootId: ROOT_PAGE_ID,
      crawledAt: new Date().toISOString(),
      pages: [],
      databases: []
    };
  }

  async crawl() {
    logger.info(`Starting recursive sync crawling from root identifier: ${ROOT_PAGE_ID}`);
    try {
      // First try to retrieve the page
      let rootPage;
      try {
        rootPage = await apiCallWithRetry(
          () => notion.pages.retrieve({ page_id: ROOT_PAGE_ID }),
          `Root Page Retrieve [${ROOT_PAGE_ID}]`
        );
      } catch (error) {
        logger.error(`Failed to retrieve root page. Make sure the page is shared with your integration.`, error);
        throw error;
      }

      // Try to get the title from different possible property names
      let rootTitle = 'Workspace Root';
      if (rootPage.properties) {
        const props = rootPage.properties;
        if (props.title?.title?.[0]?.plain_text) {
          rootTitle = props.title.title[0].plain_text;
        } else if (props.Name?.title?.[0]?.plain_text) {
          rootTitle = props.Name.title[0].plain_text;
        } else if (props['Page']?.title?.[0]?.plain_text) {
          rootTitle = props['Page'].title[0].plain_text;
        }
      }
      
      logger.info(`Successfully targeted root workspace node: "${rootTitle}"`);

      await this.traverseNode(ROOT_PAGE_ID, 'page', rootTitle, null);

      const manifestPath = path.join('./logs', 'workspace-manifest.json');
      const dir = path.dirname(manifestPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
      logger.info(`Crawl phase finished successfully. Manifest saved with ${this.manifest.pages.length} pages and ${this.manifest.databases.length} databases.`);

      return this.manifest;
    } catch (err) {
      logger.error("Critical failure during crawling cycle execution", err);
      throw err;
    }
  }

  async traverseNode(id, type, title, parentId) {
    const cleanId = id.replace(/-/g, '');
    if (this.visitedNodes.has(cleanId)) return;
    this.visitedNodes.set(cleanId, true);

    if (type === 'page') {
      logger.info(`Crawling Page: [${title}] (ID: ${cleanId})`);
      this.manifest.pages.push({ id: cleanId, title, parentId, crawledAt: new Date().toISOString() });
      await this.scanBlockChildren(id);
    } else if (type === 'database') {
      logger.info(`Crawling Database: [${title}] (ID: ${cleanId})`);
      this.manifest.databases.push({ id: cleanId, title, parentId, crawledAt: new Date().toISOString() });
    }
  }

  async scanBlockChildren(blockId) {
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      try {
        const response = await apiCallWithRetry(
          () => notion.blocks.children.list({ block_id: blockId, start_cursor: startCursor, page_size: 100 }),
          `List Block Children [${blockId}]`
        );

        for (const block of response.results) {
          if (block.type === 'child_page') {
            await this.traverseNode(block.id, 'page', block.child_page.title, blockId);
          } else if (block.type === 'child_database') {
            await this.traverseNode(block.id, 'database', block.child_database.title, blockId);
          }
        }

        hasMore = response.has_more;
        startCursor = response.next_cursor;
      } catch (error) {
        logger.error(`Error scanning blocks for ${blockId}:`, error.message || error);
        break;
      }
    }
  }
}
