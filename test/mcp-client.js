import http from 'http';
import fs from 'fs';

/**
 * MCP Client that uses SSE for transport and JSON-RPC 2.0 format
 */
export class MCPClient {
  constructor(options = {}) {
    this.options = {
      hostname: options.hostname || 'localhost',
      port: options.port || 8090,
      sessionId: null,
      verbose: options.verbose !== undefined ? options.verbose : true,
    };
    
    this.isConnected = false;
    this.pendingPromises = new Map();
    this.messageCounter = 0;
    this.onMessageHandlers = [];
  }

  log(message) {
    if (this.options.verbose) {
      console.log(`[MCP CLIENT] ${message}`);
    }
  }

  /**
   * Connect to the SSE endpoint to establish a session
   */
  async connect() {
    this.log('Connecting to SSE endpoint...');

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: this.options.hostname,
        port: this.options.port,
        path: '/sse',
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        }
      }, (res) => {
        this.log(`SSE connection established (${res.statusCode})`);

        res.on('data', (chunk) => {
          const data = chunk.toString();
          this.handleSSEMessage(data);
        });

        res.on('end', () => {
          this.log('SSE connection closed by server');
          this.isConnected = false;
        });

        this.isConnected = true;
        this.sseResponse = res;
        
        // Resolve when we get a sessionId, not immediately
        if (this.options.sessionId) {
          resolve(this.options.sessionId);
        }
      });

      req.on('error', (err) => {
        this.log(`Connection error: ${err.message}`);
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Process SSE messages
   */
  handleSSEMessage(data) {
    const messages = data.split('\n\n');

    for (const message of messages) {
      if (!message.trim()) continue;

      const match = message.match(/^data: (.+)$/m);
      if (match) {
        try {
          const parsedData = JSON.parse(match[1]);
          this.log(`Received SSE message: ${JSON.stringify(parsedData)}`);

          // Handle connection establishment
          if (parsedData.type === 'connection' && parsedData.status === 'established') {
            this.options.sessionId = parsedData.sessionId;
            this.log(`Session ID: ${this.options.sessionId}`);
          }

          // Handle JSON-RPC responses
          if (parsedData.jsonrpc === '2.0' && parsedData.id && this.pendingPromises.has(parsedData.id)) {
            const { resolve } = this.pendingPromises.get(parsedData.id);
            resolve(parsedData);
            this.pendingPromises.delete(parsedData.id);
          }

          // Notify all handlers
          this.onMessageHandlers.forEach(handler => handler(parsedData));
        } catch (err) {
          this.log(`Error parsing SSE data: ${err.message}`);
        }
      }
    }
  }

  /**
   * Send a message to the MCP server
   */
  async sendMessage(message) {
    if (!this.isConnected || !this.options.sessionId) {
      throw new Error('Not connected to server - call connect() first');
    }

    const messageId = message.id || `msg_${Date.now()}_${this.messageCounter++}`;
    if (!message.id) {
      message.id = messageId;
    }

    return new Promise((resolve, reject) => {
      // Store the promise resolvers
      this.pendingPromises.set(messageId, { resolve, reject });

      // Set request timeout
      const timeout = setTimeout(() => {
        if (this.pendingPromises.has(messageId)) {
          this.pendingPromises.delete(messageId);
          reject(new Error(`Request timed out after 10 seconds: ${messageId}`));
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
        // Response is handled through SSE
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

      // Send the message in JSON-RPC 2.0 format
      this.log(`Sending message: ${JSON.stringify(message)}`);
      req.write(JSON.stringify(message));
      req.end();
    });
  }

  /**
   * Call a tool on the MCP server
   */
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

  /**
   * Add a message handler
   */
  onMessage(handler) {
    this.onMessageHandlers.push(handler);
    return this; // For chaining
  }

  /**
   * Close the connection
   */
  async close() {
    this.log('Closing connection...');
    this.isConnected = false;
    // No need to explicitly close SSE connection
  }

  // Helper methods for specific MCP tools
  async generateField(fieldSpec) {
    return this.callTool('generate', {
      type: 'field',
      options: fieldSpec
    });
  }

  async generateCollection(collectionSpec) {
    return this.callTool('generate', {
      type: 'collection',
      options: collectionSpec
    });
  }

  async generateTemplate(type, options) {
    return this.callTool('generate', {
      type,
      options
    });
  }

  async generateCode(prompt, context) {
    return this.callTool('generate', {
      prompt,
      context
    });
  }
} 