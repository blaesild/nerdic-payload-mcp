import fetch from 'node-fetch';

// Base URL for the API
const BASE_URL = 'http://localhost:8090';

// Helper function to make API calls
async function callAPI(endpoint, body) {
  try {
    console.log(`Making request to ${endpoint}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }
    
    return { status: response.status, data };
  } catch (error) {
    console.error(`API call error:`, error);
    return { error: error.message };
  }
}

// Test different JSON-RPC parameter extraction formats
async function runTests() {
  console.log('=== Testing JSON-RPC Parameter Extraction ===');
  
  try {
    // First try a simple API health check
    console.log('\nTesting API health endpoint:');
    const healthResult = await fetch(`${BASE_URL}/api/health`);
    console.log(`Health check status: ${healthResult.status}`);
    console.log(await healthResult.text());
  
    // 1. Test direct format (non-JSON-RPC)
    console.log('\n1. Direct format test:');
    const directResult = await callAPI('/api/mcp/generate/field', {
      name: 'title',
      type: 'text',
      required: true
    });
    console.log(`Status: ${directResult.status}`);
    console.log(directResult.data);
    
    // 2. Test JSON-RPC format with params field
    console.log('\n2. JSON-RPC with params field:');
    const jsonRpcParamsResult = await callAPI('/api/mcp/generate/field', {
      jsonrpc: '2.0',
      method: 'generate',
      params: {
        name: 'description',
        type: 'richText',
        required: false
      },
      id: 'test-1'
    });
    console.log(`Status: ${jsonRpcParamsResult.status}`);
    console.log(jsonRpcParamsResult.data);
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests().catch(console.error); 