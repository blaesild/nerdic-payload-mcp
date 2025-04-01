// Test client for MCP SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function main() {
  try {
    console.log('Starting MCP test client...');
    
    // Create a client transport
    const transport = new SSEClientTransport({
      sseUrl: 'http://localhost:8090/sse',
      messageUrl: 'http://localhost:8090/messages'
    });
    
    // Create an MCP client with capabilities
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
    
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('Connected to MCP server');
    
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
  } catch (error) {
    console.error('Error in MCP test client:', error);
  }
}

main().catch(console.error); 