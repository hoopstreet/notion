import fetch from 'node-fetch';
import { Agent } from 'https';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.NOTION_TOKEN;
const pageId = process.env.NOTION_PAGE_ID;

// Use a custom agent with more conservative settings
const agent = new Agent({
  rejectUnauthorized: false, // Only for testing
  keepAlive: true,
  timeout: 30000
});

async function testNotionWithCustomAgent() {
  console.log('Testing with custom agent...');
  
  try {
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Notion-Termux-Client'
      },
      body: JSON.stringify({
        query: '',
        filter: {
          property: 'object',
          value: 'page'
        }
      }),
      timeout: 30000,
      agent: agent
    });

    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Found', data.results?.length || 0, 'pages');
      if (data.results && data.results.length > 0) {
        console.log('First page ID:', data.results[0].id);
        console.log('First page title:', data.results[0].properties?.title?.title?.[0]?.plain_text || 'No title');
      }
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.log('💡 Trying alternative approach...');
    
    // Alternative: Use curl command
    console.log('\nTry this command manually:');
    console.log(`curl -X POST https://api.notion.com/v1/search \\
  -H "Authorization: Bearer ${token}" \\
  -H "Notion-Version: 2022-06-28" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"","filter":{"property":"object","value":"page"}}'`);
  }
}

testNotionWithCustomAgent();
