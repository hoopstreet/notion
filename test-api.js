import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.NOTION_TOKEN;
const pageId = process.env.NOTION_PAGE_ID;

console.log('Token:', token ? '✅ Present (length: ' + token.length + ')' : '❌ Missing');
console.log('Page ID:', pageId || '❌ Missing');

async function test() {
  console.log('\n🔍 Testing Notion API access...');
  
  try {
    // Test 1: Search for pages
    console.log('\n📋 Test 1: Searching for pages...');
    const searchRes = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '',
        filter: {
          property: 'object',
          value: 'page'
        }
      })
    });
    
    console.log('Search Status:', searchRes.status);
    if (searchRes.ok) {
      const data = await searchRes.json();
      console.log('✅ Found', data.results?.length || 0, 'pages');
      if (data.results && data.results.length > 0) {
        console.log('First accessible page ID:', data.results[0].id);
        console.log('Title:', data.results[0].properties?.title?.title?.[0]?.plain_text || 'No title');
      }
    } else {
      const error = await searchRes.text();
      console.log('❌ Search error:', error);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
    console.log('💡 This might be a Termux network issue. Try:');
    console.log('   pkg install openssl-tool');
    console.log('   pkg install ca-certificates');
  }
}

test();
