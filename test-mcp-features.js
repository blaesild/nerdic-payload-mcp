import * as http from 'http';
import { createInterface } from 'readline';

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
      }, 10000);
      
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

// Main test function
async function runTests() {
  const client = new MCPTestClient();
  
  try {
    console.log('Starting MCP feature tests...');
    await client.connect();
    
    // Create a readline interface for interactive testing
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== MCP Feature Test Menu ===');
    console.log('1. Test validate tool');
    console.log('2. Test query tool');
    console.log('3. Test generate tool');
    console.log('4. Test scaffold tool');
    console.log('5. Test connection monitoring');
    console.log('6. Exit');
    
    const askQuestion = () => {
      rl.question('\nEnter option (1-6): ', async (answer) => {
        try {
          switch (answer.trim()) {
            case '1':
              await testValidate(client);
              break;
            case '2':
              await testQuery(client);
              break;
            case '3':
              await testGenerate(client);
              break;
            case '4':
              await testScaffold(client);
              break;
            case '5':
              await testConnectionMonitoring(client);
              break;
            case '6':
              await client.close();
              rl.close();
              console.log('Test completed');
              return;
            default:
              console.log('Invalid option, try again');
          }
        } catch (error) {
          console.error('Error during test:', error);
        }
        
        askQuestion();
      });
    };
    
    askQuestion();
    
  } catch (error) {
    console.error('Test failed:', error);
    client.close();
  }
}

// Test functions
async function testValidate(client) {
  console.log('\nTesting validate tool...');
  const schema = 'test-schema';
  const data = { name: 'Test User', email: 'test@example.com' };
  
  try {
    const result = await client.validate(schema, data);
    console.log('Validation result:', result);
    return result;
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }
}

async function testQuery(client) {
  console.log('\nTesting query tool...');
  const queryString = 'test query';
  
  try {
    const result = await client.query(queryString);
    console.log('Query result:', result);
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

async function testGenerate(client) {
  console.log('\nTesting generate tool...');
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve, reject) => {
    rl.question('Enter a prompt for generation: ', async (prompt) => {
      try {
        if (!prompt.trim()) {
          prompt = 'Generate a sample TypeScript function that calculates fibonacci numbers';
        }
        
        const result = await client.generate(prompt);
        console.log('Generation result:', result);
        rl.close();
        resolve(result);
      } catch (error) {
        console.error('Generation error:', error);
        rl.close();
        reject(error);
      }
    });
  });
}

async function testScaffold(client) {
  console.log('\nTesting scaffold tool...');
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
  
  try {
    const result = await client.scaffold(scaffoldType, parameters);
    console.log('Scaffold result:', result);
    return result;
  } catch (error) {
    console.error('Scaffold error:', error);
    throw error;
  }
}

async function testConnectionMonitoring(client) {
  console.log('\nTesting connection monitoring...');
  
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
            console.log('Connection monitoring result:');
            console.log(JSON.stringify(jsonData, null, 2));
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

// Start the tests
runTests().catch(console.error); 