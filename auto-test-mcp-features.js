import * as http from 'http';

// Create a client for testing MCP features
class MCPTestClient {
  constructor(options = {}) {
    this.options = {
      hostname: options.hostname || 'localhost',
      port: options.port || 8090,
      sessionId: null,
      verbose: options.verbose || true
    };
    
    this.isConnected = false;
    this.pendingPromises = new Map();
    this.messageCounter = 0;
  }
  
  log(message) {
    if (this.options.verbose) {
      console.log(`[CLIENT] ${message}`);
    }
  }
  
  async connect() {
    this.log('Connecting to SSE endpoint...');
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.options.hostname,
        port: this.options.port,
        path: '/sse',
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        }
      };
      
      const req = http.request(options, (res) => {
        this.log(`SSE connection established (${res.statusCode})`);
        
        // Handle SSE messages
        res.on('data', (chunk) => {
          const data = chunk.toString();
          this.handleSSEMessage(data);
        });
        
        res.on('end', () => {
          this.log('SSE connection closed by server');
          this.isConnected = false;
        });
        
        this.sseResponse = res;
        this.isConnected = true;
        resolve(true);
      });
      
      req.on('error', (err) => {
        this.log(`Connection error: ${err.message}`);
        reject(err);
      });
      
      req.end();
    });
  }
  
  handleSSEMessage(data) {
    // SSE messages are formatted as "data: {...}" with double newlines as separators
    const messages = data.split('\n\n');
    
    for (const message of messages) {
      if (!message.trim()) continue;
      
      // Match "data: {...}" pattern
      const match = message.match(/^data: (.+)$/m);
      if (match) {
        try {
          const parsedData = JSON.parse(match[1]);
          this.log(`Received: ${JSON.stringify(parsedData)}`);
          
          // Handle connection establishment
          if (parsedData.type === 'connection' && parsedData.status === 'established') {
            this.options.sessionId = parsedData.sessionId;
            this.log(`Session ID: ${this.options.sessionId}`);
          }
          
          // Handle tool responses
          if (parsedData.id && this.pendingPromises.has(parsedData.id)) {
            const { resolve } = this.pendingPromises.get(parsedData.id);
            resolve(parsedData);
            this.pendingPromises.delete(parsedData.id);
          }
        } catch (err) {
          this.log(`Error parsing SSE data: ${err.message}`);
        }
      }
    }
  }
  
  async sendMessage(message) {
    if (!this.isConnected || !this.options.sessionId) {
      throw new Error('Not connected to server');
    }
    
    const messageId = `msg_${Date.now()}_${this.messageCounter++}`;
    message.id = messageId;
    
    return new Promise((resolve, reject) => {
      // Store the promise resolvers
      this.pendingPromises.set(messageId, { resolve, reject });
      
      // Set request timeout
      const timeout = setTimeout(() => {
        if (this.pendingPromises.has(messageId)) {
          this.pendingPromises.delete(messageId);
          reject(new Error('Request timed out'));
        }
      }, 30000);
      
      const options = {
        hostname: this.options.hostname,
        port: this.options.port,
        path: `/messages?sessionId=${this.options.sessionId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Message-Id': messageId
        }
      };
      
      const req = http.request(options, (res) => {
        // Handle response
        res.on('data', (chunk) => {
          // Message handled through SSE
        });
        
        res.on('end', () => {
          // Request completed
        });
      });
      
      req.on('error', (err) => {
        clearTimeout(timeout);
        if (this.pendingPromises.has(messageId)) {
          this.pendingPromises.delete(messageId);
          reject(err);
        }
      });
      
      // Send the message
      req.write(JSON.stringify(message));
      req.end();
      
      this.log(`Sent message: ${JSON.stringify(message)}`);
    });
  }
  
  async callTool(toolName, args) {
    return this.sendMessage({
      jsonrpc: '2.0',
      method: 'callTool',
      params: {
        name: toolName,
        arguments: args
      }
    });
  }
  
  async close() {
    this.log('Closing connection...');
    this.isConnected = false;
    // No need to explicitly close the SSE connection as it will be closed by the server
  }
  
  // Helper methods for specific tools
  async validate(schema, data) {
    return this.callTool('validate', { schema, data });
  }
  
  async query(queryString) {
    return this.callTool('query', { query: queryString });
  }
  
  async generate(prompt, options = {}) {
    return this.callTool('generate', { prompt, options });
  }
  
  async scaffold(type, parameters = {}) {
    return this.callTool('scaffold', { type, parameters });
  }
}

// Test connection monitoring
async function testConnectionMonitoring(client) {
  console.log('\n=== Testing Connection Monitoring ===');
  
  try {
    const options = {
      hostname: client.options.hostname,
      port: client.options.port,
      path: '/connections',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            console.log('Active connections:', jsonData.activeConnections);
            console.log('Connection details:');
            console.log(JSON.stringify(jsonData.connections, null, 2));
            resolve(jsonData);
          } catch (e) {
            console.error('Error parsing connection data:', e);
            reject(e);
          }
        });
      });
      
      req.on('error', (e) => {
        console.error('Connection monitoring error:', e);
        reject(e);
      });
      
      req.end();
    });
  } catch (error) {
    console.error('Connection monitoring error:', error);
    throw error;
  }
}

// Test message queue statistics
async function testMessageQueueStats() {
  console.log('\n=== Testing Message Queue Statistics ===');
  
  try {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8090,
        path: '/message-queue/stats',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            console.log('Message queue statistics:');
            console.log(JSON.stringify(jsonData, null, 2));
            resolve(jsonData);
          } catch (e) {
            console.error('Error parsing message queue stats:', e);
            reject(e);
          }
        });
      });
      
      req.on('error', (e) => {
        console.error('Message queue stats error:', e);
        reject(e);
      });
      
      req.end();
    });
  } catch (error) {
    console.error('Message queue stats error:', error);
    throw error;
  }
}

// Main test function
async function runAutomatedTests() {
  const client = new MCPTestClient();
  
  try {
    console.log('Starting MCP automated feature tests...');
    await client.connect();
    
    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Connection Monitoring
    console.log('\n=== Test 1: Connection Monitoring ===');
    await testConnectionMonitoring(client);
    
    // Test 2: Message Queue Stats
    console.log('\n=== Test 2: Message Queue Statistics ===');
    await testMessageQueueStats();
    
    // Test 3: Validate Tool
    console.log('\n=== Test 3: Validate Tool ===');
    const schema = 'test-schema';
    const data = { name: 'Test User', email: 'test@example.com' };
    try {
      const validationResult = await client.validate(schema, data);
      console.log('Validation result:', validationResult);
    } catch (error) {
      console.error('Validation error:', error);
    }
    
    // Test 4: Query Tool
    console.log('\n=== Test 4: Query Tool ===');
    try {
      const queryResult = await client.query('test query');
      console.log('Query result:', queryResult);
    } catch (error) {
      console.error('Query error:', error);
    }
    
    // Test 5: Generate Tool
    console.log('\n=== Test 5: Generate Tool ===');
    try {
      const prompt = 'Generate a sample TypeScript function that calculates fibonacci numbers';
      const generateResult = await client.generate(prompt);
      console.log('Generate result:', generateResult);
    } catch (error) {
      console.error('Generate error:', error);
    }
    
    // Test 6: Scaffold Tool
    console.log('\n=== Test 6: Scaffold Tool ===');
    try {
      const scaffoldType = 'collection';
      const parameters = {
        slug: 'test-collection',
        singular: 'Test Item',
        plural: 'Test Items',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'textarea' }
        ]
      };
      const scaffoldResult = await client.scaffold(scaffoldType, parameters);
      console.log('Scaffold result:', scaffoldResult);
    } catch (error) {
      console.error('Scaffold error:', error);
    }
    
    console.log('\nAll tests completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
    console.log('Test client disconnected');
  }
}

// Start the automated tests
runAutomatedTests().catch(console.error); 