import fs from 'fs';
import path from 'path';
import { Client } from '@notionhq/client';
import { apiCallWithRetry } from './crawl.js';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();
const client = new Client({ auth: process.env.NOTION_TOKEN });

export async function exportDatabases(manifest) {
  logger.info(`Starting database export sequence for ${manifest.databases.length} entries.`);
  const baseDir = './databases';

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  for (const db of manifest.databases) {
    try {
      logger.info(`Exporting Structured Database: [${db.title}] (${db.id})`);

      let rows = [];
      let hasMore = true;
      let cursor = undefined;

      while (hasMore) {
        const response = await apiCallWithRetry(
          () => client.databases.query({ database_id: db.id, start_cursor: cursor, page_size: 100 }),
          `Export DB Query [${db.title}]`
        );
        rows.push(...response.results);
        hasMore = response.has_more;
        cursor = response.next_cursor || undefined;
      }

      const cleanData = rows.map(row => {
        const item = {
          _id: row.id.replace(/-/g, ''),
          _url: row.url,
          _created_time: row.created_time,
          _last_edited_time: row.last_edited_time
        };

        for (const [key, prop] of Object.entries(row.properties)) {
          item[key] = extractPropertyValue(prop);
        }
        return item;
      });

      const fileName = `${db.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${db.id}.json`;
      fs.writeFileSync(path.join(baseDir, fileName), JSON.stringify(cleanData, null, 2));
      logger.info(`Successfully wrote table schema snapshot: ${fileName}`);
    } catch (err) {
      logger.error(`Failed to export target database structure: ${db.title}`, err);
    }
  }
}

function extractPropertyValue(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return prop[prop.type]?.map(t => t.plain_text).join('') || '';
    case 'number':
      return prop.number;
    case 'select':
      return prop.select?.name || null;
    case 'multi_select':
      return prop.multi_select?.map(s => s.name) || [];
    case 'date':
      return prop.date ? { start: prop.date.start, end: prop.date.end } : null;
    default:
      return prop[prop.type] || null;
  }
}
