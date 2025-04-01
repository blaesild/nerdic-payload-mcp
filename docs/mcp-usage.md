# MCP Protocol Usage Guide

This guide outlines how to use the MCP (Model Context Protocol) server to generate Payload CMS components.

## Prerequisites

- MCP server running on `localhost:8090` (or configure a different host/port)
- Node.js for running the test scripts

## Key Concepts

### Two Ways to Use the API

The MCP server supports two primary methods of interaction:

1. **Direct REST API Calls** - Recommended for most use cases
   - Simple HTTP POST requests to specific endpoints
   - Supports both direct and JSON-RPC formatted requests
   - Most reliable option for production use

2. **SSE Transport** - For real-time applications
   - Long-lived connections using Server-Sent Events (SSE)
   - Supports session-based messaging
   - May have compatibility issues with certain request types

### JSON-RPC 2.0 Format

All endpoints support the JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "method": "callTool",
  "params": {
    "name": "toolName",
    "arguments": {
      // tool-specific arguments
    }
  },
  "id": "unique-request-id"
}
```

The response will also be in JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "result": {
    // result data
  },
  "id": "unique-request-id"
}
```

## Direct API Endpoints (Recommended)

### Generate Field

```bash
POST /api/mcp/generate/field
```

**Direct Format Example:**
```json
{
  "name": "title",
  "type": "text",
  "required": true,
  "label": "Title"
}
```

**JSON-RPC Format Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "callTool",
  "params": {
    "name": "field",
    "arguments": {
      "name": "title",
      "type": "text",
      "required": true,
      "label": "Title"
    }
  },
  "id": "request-123"
}
```

### Generate Collection

```bash
POST /api/mcp/generate/collection
```

**Example:**
```json
{
  "slug": "posts",
  "label": "Blog Posts",
  "fields": [
    {
      "name": "title",
      "type": "text",
      "required": true
    },
    {
      "name": "content",
      "type": "richText"
    }
  ]
}
```

### Generate Template

```bash
POST /api/mcp/generate/template
```

**Example:**
```json
{
  "type": "component",
  "name": "Button",
  "props": ["text", "onClick", "variant"]
}
```

### Generate Code

```bash
POST /api/mcp/generate/code
```

**Example:**
```json
{
  "prompt": "Create a function that calculates the total price with tax",
  "context": "function calculateSubtotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }"
}
```

## SSE Transport Connection Flow

For applications that require real-time updates:

1. Connect to the SSE endpoint at `/sse`
2. Receive a session ID from the server
3. Send messages to `/messages?sessionId={your-session-id}`
4. Receive responses through the SSE connection

### Example SSE Connection

```javascript
// Connect to SSE endpoint
const eventSource = new EventSource('/sse');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // Handle connection establishment
  if (data.type === 'connection') {
    const sessionId = data.sessionId;
    console.log(`Connected with session ID: ${sessionId}`);
    
    // Now you can send messages using the session ID
    sendMessage(sessionId, {
      jsonrpc: '2.0',
      method: 'callTool',
      params: {
        name: 'generate',
        arguments: {
          type: 'field',
          options: {
            name: 'title',
            type: 'text'
          }
        }
      },
      id: 'msg-123'
    });
  }
  
  // Handle responses
  if (data.jsonrpc === '2.0' && data.result) {
    console.log('Received result:', data.result);
  }
};

// Function to send messages
function sendMessage(sessionId, message) {
  fetch(`/messages?sessionId=${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });
}
```

## Error Handling

The server provides detailed error responses in both direct API and SSE modes:

### JSON-RPC Errors

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Error message details",
    "data": {
      "additionalInfo": "..."
    }
  },
  "id": "request-123"
}
```

### Stream Error Workaround

If you encounter `"stream is not readable"` errors when using the SSE transport, switch to using the direct API endpoints instead.

## MCP Client Library

We've provided an `MCPClient` class in `test/mcp-client.js` that handles the connection flow automatically:

```javascript
const { MCPClient } = require('./mcp-client');

async function main() {
  const client = new MCPClient();
  
  // Connect to the server
  await client.connect();
  
  // Generate a field
  const fieldSpec = { name: 'title', type: 'text', required: true };
  const result = await client.generateField(fieldSpec);
  
  console.log(result);
  
  // Close connection when done
  await client.close();
}

main();
```

## Best Practices

1. **Prefer Direct API Calls**: Use the direct REST API endpoints when possible for maximum reliability.

2. **Handle Errors Gracefully**: Always check for and handle error responses appropriately.

3. **Format Validation**: Ensure your requests match the expected format for each endpoint.

4. **Use JSON-RPC IDs**: When using JSON-RPC format, always include a unique ID to track responses.

5. **SSE Fallback**: If using SSE transport, have a fallback mechanism to use direct API calls if stream errors occur.

## Available Tools

The MCP server provides the following tools:

### Generate Tool

The `generate` tool can create different Payload CMS components:

- **Fields**: Create field definitions for different field types
- **Collections**: Create complete collection configurations
- **Templates**: Generate templates for components, hooks, etc.
- **Code**: Generate context-aware code

Examples:

```javascript
// Generate a field
client.generateField({
  name: 'content',
  type: 'richText',
  required: true
});

// Generate a collection
client.generateCollection({
  slug: 'posts',
  singular: 'Post',
  plural: 'Posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richText' }
  ]
});
```

## Troubleshooting

- **Invalid JSON-RPC 2.0 request**: Make sure your request includes the required `jsonrpc`, `method`, and `id` fields
- **Missing required parameters**: Check that all required parameters are provided in the correct format
- **Connection issues**: Ensure the MCP server is running and the hostname/port configuration is correct

## Test Scripts

We've provided test scripts in the `test/` directory to demonstrate proper usage:

- `test-field-generation.js`: Demonstrates how to generate different field types
- `test-collection-generation.js`: Demonstrates how to generate collections

Run the tests with:

```
node test/test-field-generation.js
```

Results will be saved in the `test-results/` directory. 