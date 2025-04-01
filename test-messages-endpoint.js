// Use dynamic imports to get around ESM/CommonJS issues
async function main() {
  // Dynamically import the packages
  const [{ default: fetch }, { default: EventSource }] = await Promise.all([
    import('node-fetch'),
    import('eventsource')
  ]);

  // Base URL for the API
  const BASE_URL = 'http://localhost:8090';

  // Helper function to connect to SSE and get a session ID
  async function connectToSSE() {
    try {
      console.log('Connecting to SSE endpoint...');
      
      return new Promise((resolve, reject) => {
        let sessionId = null;
        
        // Create an EventSource for SSE connection
        const eventSource = new EventSource(`${BASE_URL}/sse`);
        
        // Handle connection open
        eventSource.onopen = () => {
          console.log('SSE connection established');
        };
        
        // Handle messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`Received SSE message:`, data);
            
            // Handle connection establishment
            if (data.type === 'connection' && data.status === 'established') {
              sessionId = data.sessionId;
              console.log(`Session ID: ${sessionId}`);
              eventSource.close();
              resolve(sessionId);
            }
          } catch (error) {
            console.error('Error processing SSE message:', error);
            eventSource.close();
            reject(error);
          }
        };
        
        // Handle errors
        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          eventSource.close();
          reject(new Error('SSE connection failed'));
        };
        
        // Set timeout
        setTimeout(() => {
          if (!sessionId) {
            eventSource.close();
            reject(new Error('Timeout waiting for session ID'));
          }
        }, 5000);
      });
    } catch (error) {
      console.error(`Error connecting to SSE:`, error);
      throw error;
    }
  }

  // Helper function to send a message
  async function sendMessage(sessionId, message) {
    try {
      const response = await fetch(`${BASE_URL}/messages?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error sending message:`, error);
      return { error: error.message };
    }
  }

  // Test different message formats
  async function runTests() {
    console.log('=== Testing /messages Endpoint ===');
    
    try {
      // Connect to SSE and get session ID
      const sessionId = await connectToSSE();
      console.log(`Using session ID: ${sessionId}`);
      
      // 1. Test standard JSON-RPC generate field request
      console.log('\n1. Testing standard JSON-RPC generate field request:');
      const fieldResult = await sendMessage(sessionId, {
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
      console.log(fieldResult);
      
      // 2. Test JSON-RPC template request
      console.log('\n2. Testing JSON-RPC template request:');
      const templateResult = await sendMessage(sessionId, {
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
      console.log(templateResult);
    } catch (error) {
      console.error('Test failed:', error);
    }
  }

  // Run the tests
  await runTests();
}

// Run the main function
main().catch(console.error); 