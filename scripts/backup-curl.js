import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const execAsync = promisify(exec);
const token = process.env.NOTION_TOKEN;
const pageId = process.env.NOTION_PAGE_ID;

async function notionRequest(endpoint, method = 'GET', data = null) {
  const cmd = `curl -s -X ${method} https://api.notion.com/v1${endpoint} \
    -H "Authorization: Bearer ${token}" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    ${data ? `-d '${JSON.stringify(data)}'` : ''}`;
  
  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr) logger.warn('Curl stderr:', stderr);
    return JSON.parse(stdout);
  } catch (error) {
    logger.error('Curl error:', error.message);
    throw error;
  }
}

async function main() {
  logger.info('=== Starting Notion Backup with Curl ===');
  
  try {
    // Search for all pages
    const searchResult = await notionRequest('/search', 'POST', {
      query: '',
      filter: {
        property: 'object',
        value: 'page'
      }
    });
    
    logger.info(`✅ Found ${searchResult.results?.length || 0} pages`);
    
    // Save to file
    const outputDir = './databases';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const fileName = `workspace_pages_${new Date().toISOString().slice(0,10)}.json`;
    fs.writeFileSync(
      path.join(outputDir, fileName),
      JSON.stringify(searchResult, null, 2)
    );
    
    logger.info(`✅ Saved workspace data to ${fileName}`);
    logger.info('=== Backup Complete ===');
    
  } catch (error) {
    logger.error('Backup failed:', error);
    process.exit(1);
  }
}

main();
