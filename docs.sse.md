# Server-Sent Events (SSE) Implementation Documentation
 
## Overview
 
This document details our work on implementing Server-Sent Events (SSE) in the Nerdic Payload MCP project, including current implementation, features, and usage guidelines.
 
## Current Implementation
 
### Server-Side Implementation
 
The SSE implementation uses the `@modelcontextprotocol/sdk` package for SSE transport with significant enhancements for reliability, connection management, and error handling. Key components include:
 
1. Connection Management:
```typescript
// Enhanced connection management with detailed tracking
export class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Methods to manage connections lifecycle
  addConnection(transport, res) {...}
  updateActivity(sessionId) {...}
  cleanupConnection(sessionId) {...}
  // ...
}
```
 
2. Message Queue System:
```typescript
// Message queue for reliability
export class MessageQueue extends EventEmitter {
  private messages: Map<string, QueuedMessage> = new Map();
  
  // Methods for reliable message delivery
  enqueue(sessionId, payload) {...}
  acknowledge(messageId) {...}
  getUnacknowledgedMessages(sessionId) {...}
  // ...
}
```
 
3. Enhanced SSE Endpoint (`/sse`):
```typescript
app.get("/sse", async (req: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  connectionManager.addConnection(transport, res);
  await mcpServer.connect(transport);
});
```
 
4. Enhanced Message Handling Endpoint (`/messages`):
```typescript
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  
  // Handle acknowledgments
  if (req.query.ack === 'true' && req.query.messageId) {...}
  
  // Handle reconnection and pending messages
  if (req.query.reconnect === 'true') {...}
  
  // Regular message handling with reliability features
  const connection = connectionManager.getConnection(sessionId);
  if (connection?.transport) {
    // Queue message for reliability
    const queuedMessageId = messageQueue.enqueue(sessionId, req.body);
    await connection.transport.handlePostMessage(req, res);
    res.setHeader('X-Message-Id', queuedMessageId);
  }
});
```
 
### Client-Side Implementation
 
An enhanced client (`EnhancedSSEClient`) has been created to provide reliable connections:
 
```javascript
class EnhancedSSEClient {
  constructor(config) {
    // Configuration
    this.sseUrl = config.sseUrl;
    this.messageUrl = config.messageUrl;
    this.onMessage = config.onMessage || (() => {});
    
    // Connection state
    this.sessionId = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    
    // Connect immediately
    this.connect();
  }
  
  // Methods for reliable connection
  connect() {...}
  reconnect() {...}
  sendMessage(data) {...}
  acknowledgeMessage(messageId) {...}
  checkPendingMessages() {...}
}
```
 
The test client (`test-mcp-client.js`) has been updated to use the enhanced client:
 
```javascript
const sseClient = new EnhancedSSEClient({
  sseUrl: 'http://localhost:8090/sse',
  messageUrl: 'http://localhost:8090/messages',
  onMessage: (data) => {...},
  onError: (error) => {...},
  onReconnect: () => {...}
});

// MCP client integration
await client.connect({
  send: async (message) => {
    return sseClient.sendMessage(message);
  },
  receive: (handler) => {...}
});
```
 
## Features and Improvements
 
The implementation addresses previously identified challenges:
 
1. **Connection Stability**
   - ✅ Robust connection tracking with detailed metadata
   - ✅ Automatic reconnection with exponential backoff
   - ✅ Heartbeat system for monitoring connection health
   - ✅ Proper cleanup of resources on disconnect
 
2. **Message Reliability**
   - ✅ Message queue system for tracking message delivery
   - ✅ Message acknowledgment mechanism
   - ✅ Recovery of unacknowledged messages on reconnection
   - ✅ Retry logic for failed messages
 
3. **Error Handling**
   - ✅ Comprehensive error detection and reporting
   - ✅ Graceful recovery from connection issues
   - ✅ Client-side error handling with automatic reconnection
 
4. **Resource Management**
   - ✅ Connection timeout for inactive sessions
   - ✅ Proper cleanup of resources (intervals, event listeners)
   - ✅ Monitoring tools for resource usage
 
## Monitoring and Debugging Tools
 
1. **Connection Monitoring Endpoint**
   - `GET /connections` provides detailed information about active connections
   - Includes creation time, last activity, heartbeat count, and more
 
2. **Message Queue Statistics**
   - `GET /message-queue/stats` provides queue statistics
   - Tracks total, acknowledged, and unacknowledged messages
 
3. **Connection Monitor Script**
   - A monitoring utility (`src/scripts/monitor-connections.ts`) provides real-time connection status
   - Run with `npm run monitor`
 
## Usage Guidelines
 
### Server Setup
 
1. The enhanced SSE implementation is automatically used when starting the server:
```bash
npm run dev
```

2. Monitor connections in a separate terminal:
```bash
npm run monitor
```

### Client Usage

1. Use the enhanced client in your applications:
```javascript
import EnhancedSSEClient from './path/to/enhanced-sse-client.js';

const sseClient = new EnhancedSSEClient({
  sseUrl: 'http://your-server/sse',
  messageUrl: 'http://your-server/messages',
  // Handlers and options...
});

// Wait for connection
await new Promise(resolve => {
  const interval = setInterval(() => {
    if (sseClient.sessionId) {
      clearInterval(interval);
      resolve();
    }
  }, 100);
});

// Send a message
await sseClient.sendMessage({/* your data */});
```

2. For testing, run the provided test client:
```bash
node test-mcp-client.js
```

## Status

Current Status: **Ready for Production Use**

All previously identified issues have been addressed:
1. ✅ Connection stability issues resolved with robust management
2. ✅ Error handling implemented comprehensively
3. ✅ Message reliability guaranteed with queue and acknowledgment system
4. ✅ Comprehensive testing tools available

## Future Improvements

While the current implementation is production-ready, future enhancements could include:

1. Persistent message storage for long-term reliability
2. Load balancing support for horizontally scaled deployments
3. Advanced metrics and monitoring dashboards
4. WebSocket fallback for environments where SSE is not supported

Please update this document as new requirements or improvements are identified.