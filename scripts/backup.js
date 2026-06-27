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
    if (stderr && !stderr.includes('Warning')) logger.warn('Curl stderr:', stderr);
    return JSON.parse(stdout);
  } catch (error) {
    logger.error('Curl error:', error.message);
    throw error;
  }
}

async function crawlWorkspace() {
  logger.info('📂 Crawling Notion workspace...');
  
  const result = await notionRequest('/search', 'POST', {
    query: '',
    filter: {
      property: 'object',
      value: 'page'
    }
  });
  
  const pages = result.results || [];
  logger.info(`✅ Found ${pages.length} pages`);
  
  // Also search for databases
  const dbResult = await notionRequest('/search', 'POST', {
    query: '',
    filter: {
      property: 'object',
      value: 'database'
    }
  });
  
  const databases = dbResult.results || [];
  logger.info(`✅ Found ${databases.length} databases`);
  
  return { pages, databases };
}

async function main() {
  try {
    logger.info('=== 🚀 Starting Notion Backup Process ===');
    
    // Crawl workspace
    const data = await crawlWorkspace();
    
    // Save results
    const outputDir = './databases';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `notion_backup_${timestamp}.json`;
    
    fs.writeFileSync(
      path.join(outputDir, fileName),
      JSON.stringify(data, null, 2)
    );
    
    logger.info(`✅ Backup saved to databases/${fileName}`);
    logger.info(`   📄 ${data.pages.length} pages`);
    logger.info(`   📊 ${data.databases.length} databases`);
    logger.info('=== ✅ Backup Complete ===');
    
  } catch (error) {
    logger.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

main();
