// Updated test client with enhanced SSE implementation
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import EnhancedSSEClient from './src/client/enhanced-sse-client.js';

async function main() {
  try {
    console.log('Starting MCP test client with enhanced SSE...');
    
    // Create an enhanced SSE client
    const sseClient = new EnhancedSSEClient({
      sseUrl: 'http://localhost:8090/sse',
      messageUrl: 'http://localhost:8090/messages',
      onMessage: (data) => {
        console.log('Received message:', data);
      },
      onError: (error) => {
        console.error('SSE error:', error);
      },
      onReconnect: () => {
        console.log('Successfully reconnected to server');
      },
      maxReconnectAttempts: 5,
      reconnectInterval: 3000
    });
    
    // Wait for connection to establish
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (sseClient.sessionId) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    console.log('Connected with sessionId:', sseClient.sessionId);
    
    // Create MCP client
    const client = new Client(
      {
        name: 'test-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    // Connect using custom send/receive functions that work with our enhanced client
    await client.connect({
      send: async (message) => {
        return sseClient.sendMessage(message);
      },
      receive: (handler) => {
        // Override the onMessage handler to integrate with MCP
        const originalHandler = sseClient.onMessage;
        sseClient.onMessage = (data) => {
          handler(data);
          originalHandler(data);
        };
        return () => {
          sseClient.onMessage = originalHandler;
        };
      }
    });
    
    console.log('MCP client connected');
    
    // Test the tools
    console.log('Testing validate tool...');
    const result = await client.callTool({
      name: 'validate',
      arguments: {
        schema: 'test-schema',
        data: { test: 'data' }
      }
    });
    
    console.log('Tool result:', result);
    
    // Keep the process running
    console.log('Client connection established. Press Ctrl+C to exit.');
    
    // Setup cleanup on exit
    process.on('SIGINT', () => {
      console.log('Disconnecting...');
      sseClient.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error in MCP test client:', error);
  }
}

main().catch(console.error); 