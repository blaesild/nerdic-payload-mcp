import fetch from 'node-fetch';

// Test direct calls to the /messages endpoint with a mock session ID
async function main() {
  const BASE_URL = 'http://localhost:8090';
  
  // Use a hardcoded session ID for testing purposes
  // This is only for testing; in a real scenario, this would come from the SSE connection
  const mockSessionId = 'test-session-123';
  
  // Helper function to send a request to the messages endpoint
  async function sendMessageRequest(message) {
    try {
      console.log(`Sending message to /messages:`, message);
      
      const response = await fetch(`${BASE_URL}/messages?sessionId=${mockSessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
      
      // Read the response
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }
      
      return {
        status: response.status,
        data: responseData
      };
    } catch (error) {
      console.error('Request error:', error);
      return { error: error.message };
    }
  }
  
  // Test generate field request
  console.log('\n=== Testing /messages endpoint with JSON-RPC ===');
  
  // Although this won't connect to the server properly without a valid session ID,
  // we can still test if the parsing logic works correctly by checking the error format
  
  // 1. Test JSON-RPC field generation
  console.log('\n1. Testing field generation:');
  const fieldResult = await sendMessageRequest({
    jsonrpc: '2.0',
    method: 'callTool',
    params: {
      name: 'generate',
      arguments: {
        type: 'field',
        options: {
          name: 'title',
          type: 'text',
          required: true
        }
      }
    },
    id: 'msg-1'
  });
  console.log(`Status: ${fieldResult.status}`);
  console.log(fieldResult.data);
  
  // 2. Test JSON-RPC template generation
  console.log('\n2. Testing template generation:');
  const templateResult = await sendMessageRequest({
    jsonrpc: '2.0',
    method: 'callTool',
    params: {
      name: 'generate',
      arguments: {
        type: 'template',
        options: {
          type: 'component',
          name: 'Button'
        }
      }
    },
    id: 'msg-2'
  });
  console.log(`Status: ${templateResult.status}`);
  console.log(templateResult.data);
}

main().catch(console.error); 