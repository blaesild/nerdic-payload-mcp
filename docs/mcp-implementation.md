# MCP Implementation Documentation

## Overview

The Model Context Protocol (MCP) implementation in this project provides a standardized way for LLM applications to interact with our Payload CMS generation tools. This implementation supports both direct RESTful API calls and the JSON-RPC 2.0 format specified by the MCP standard.

## Components

1. **MCP Server**: Implemented using the `@modelcontextprotocol/sdk` package, the MCP server exposes tools for generating Payload CMS components.

2. **API Endpoints**: RESTful endpoints for direct integration with applications that don't use the MCP protocol.

3. **Transport Layer**: The server uses SSE (Server-Sent Events) as the transport mechanism for real-time communication with clients, with integrated workarounds for known SDK issues.

## JSON-RPC Support

All API endpoints can handle requests in both direct format and JSON-RPC 2.0 format:

### Direct Format
```json
{
  "name": "title",
  "type": "text",
  "required": true
}
```

### JSON-RPC 2.0 Format
```json
{
  "jsonrpc": "2.0",
  "method": "callTool",
  "params": {
    "name": "field",
    "arguments": {
      "name": "title",
      "type": "text",
      "required": true
    }
  },
  "id": "request-123"
}
```

## MCP Tools

The following tools are exposed through the MCP protocol:

1. **generate**: A general-purpose tool that can generate different Payload CMS components based on the `type` parameter:
   - `field`: Generate a Payload field definition
   - `collection`: Generate a Payload collection
   - `template`: Generate a template
   - `code`: Generate context-aware code

2. **field**: A specialized tool for generating field definitions directly

## Implementation Details

### Parameter Extraction

The implementation uses a unified parameter extraction utility function that handles all formats consistently:

1. Direct parameters in request body
2. JSON-RPC format with parameters in the `params` field
3. JSON-RPC format with `callTool` method and nested parameters
4. JSON-RPC format with specific tool types and options

This unified approach ensures consistent parameter handling across all endpoints and tools, improving robustness and reducing duplicated code.

### SSE Transport

The SSE transport implementation follows the MCP specification but includes integrated workarounds for known issues in the SDK:

1. Clients connect to `/sse` to establish a session
2. Clients send messages to `/messages?sessionId=X` to communicate with the server
3. For all tool requests, the implementation first attempts direct handling with proper parameter extraction
4. If direct handling isn't applicable, it falls back to the SDK transport with specific error handling for stream issues
5. Stream errors are caught and transformed into meaningful error responses with workaround information

### Error Handling

The implementation includes comprehensive error handling:

1. JSON parsing errors with proper JSON-RPC error responses
2. Validation errors for missing parameters
3. Specific handling for "stream is not readable" errors with workaround instructions
4. Fallback error handling for unexpected issues
5. All errors sent via both HTTP and SSE channels for maximum reliability

## Implementation Approach

Our integrated implementation strategy:

1. **Unified Parameter Extraction**: A centralized utility function that properly extracts parameters from any JSON-RPC format, ensuring consistency across the codebase.

2. **Direct Message Handling**: For the critical `generate` tool path and others, requests are handled directly with correct parameter extraction.

3. **Specific Stream Error Handling**: The implementation catches and handles the "stream is not readable" error from the SDK, providing a meaningful error message and workaround.

4. **Enhanced Body Parsing**: Improved JSON body parsing with proper error handling for malformed requests.

5. **Transparent Errors**: All errors are properly formatted and delivered through both HTTP and SSE channels.

## Testing

The implementation has been tested with:

1. Direct API calls - WORKING
2. JSON-RPC formatted API calls - WORKING
3. SSE connections for real-time communication - WORKING with workarounds

## Known Issues

1. **SSE Stream Error**: When sending certain messages via the SSE transport using the SDK's `handlePostMessage` method, clients might receive an `"InternalServerError: stream is not readable"` error. We handle this by:
   - Providing a clear error message with workaround instructions
   - Suggesting the use of direct API endpoints instead of SSE for affected operations

2. **Node.js Client Compatibility**: The official MCP SDK client has compatibility issues with Node.js environments. We work around this by:
   - Providing a custom Node.js-compatible SSE client implementation
   - Supporting direct API calls for all operations
   - Enhancing error handling to indicate when SSE transport isn't suitable

## Root Cause Analysis

The SSE transport issues stem from two main sources:

1. **MCP SDK Transport Implementation**: The SSEServerTransport in the MCP SDK has issues with stream handling in the `handlePostMessage` method.

2. **Node.js Compatibility**: The EventSource implementation in Node.js works differently from browser environments, causing compatibility issues with the MCP SDK client.

## Solution Implementation

### Short-term Fixes (Implemented)

1. **Unified Parameter Extraction**: Created a robust utility function that handles all JSON-RPC formats consistently.

2. **Enhanced Error Handling**: Added specific handling for stream errors with clear workaround instructions.

3. **Improved Body Parsing**: Enhanced the JSON body parsing middleware with proper error handling.

4. **Direct Request Handling**: Implemented direct handling of requests to bypass SDK stream issues.

### Long-term Fixes (Planned)

1. **Contribute to MCP SDK**: Plan to submit pull requests to improve the SSEServerTransport implementation:
   - Fix the stream handling in handlePostMessage
   - Add better error handling and logging
   - Improve compatibility with Node.js environments

2. **Custom Client Library**: Potentially develop a simplified client library tailored specifically for Payload MCP.

## Implementation Recommendations

1. **SSE Transport Headers**:
   ```javascript
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('Connection', 'keep-alive');
   res.setHeader('X-Accel-Buffering', 'no');
   ```

2. **Message Format**:
   ```
   data: {"jsonrpc":"2.0",...}\n\n
   ```

3. **Parameter Extraction**:
   ```javascript
   const params = extractJSONRPCParams(req.body, "toolName");
   ```

4. **Error Handling**:
   ```javascript
   try {
     // Handle message
   } catch (error) {
     if (error.message.includes('stream is not readable')) {
       // Handle stream error with workaround information
     } else {
       // Handle other errors
     }
   }
   ```

## Conclusion

The enhanced MCP implementation provides robust support for both direct API calls and JSON-RPC formatted requests, with appropriate workarounds for known SSE transport issues. The implementation prioritizes reliability, consistent error handling, and clear workaround instructions when issues are encountered.

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/)
- [MCP TypeScript SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/README.md)
- [Model Context Protocol Introduction](https://modelcontextprotocol.io/introduction)
- [EventSource for Node.js](https://github.com/EventSource/eventsource) 