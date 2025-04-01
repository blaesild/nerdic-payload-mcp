/**
 * Enhanced SSE Client with reconnection and message reliability features
 */
class EnhancedSSEClient {
  constructor(config) {
    this.sseUrl = config.sseUrl;
    this.messageUrl = config.messageUrl;
    this.onMessage = config.onMessage || (() => {});
    this.onError = config.onError || (() => {});
    this.onReconnect = config.onReconnect || (() => {});
    
    this.sessionId = null;
    this.eventSource = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.pendingMessages = new Map();
    
    this.connect();
  }
  
  connect() {
    console.log('Connecting to SSE endpoint...');
    
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    // Create new EventSource connection
    this.eventSource = new EventSource(this.sseUrl);
    
    // Handle connection open
    this.eventSource.onopen = () => {
      console.log('SSE connection established');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // If reconnecting, check for any unacknowledged messages
      if (this.sessionId) {
        this.checkPendingMessages();
      }
    };
    
    // Handle messages
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle connection initialization
        if (data.type === 'connection' && data.status === 'established') {
          this.sessionId = data.sessionId;
          console.log(`Connection established with sessionId: ${this.sessionId}`);
        }
        
        // Handle heartbeats
        if (data.type === 'heartbeat') {
          console.log(`Heartbeat received: ${data.timestamp}`);
          return;
        }
        
        // Handle regular messages
        this.onMessage(data);
        
        // Acknowledge message receipt if an ID is provided
        if (data.messageId) {
          this.acknowledgeMessage(data.messageId);
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
        this.onError(error);
      }
    };
    
    // Handle connection errors
    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.connected = false;
      this.onError(error);
      
      // Attempt to reconnect
      this.reconnect();
    };
  }
  
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Giving up.');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
      
      // If successfully reconnected
      if (this.connected) {
        this.onReconnect();
      }
    }, this.reconnectInterval * this.reconnectAttempts); // Exponential backoff
  }
  
  async sendMessage(data) {
    if (!this.sessionId) {
      console.error('Cannot send message: No active session');
      throw new Error('No active session');
    }
    
    // Generate a client-side message ID
    const clientMsgId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store in pending messages
    this.pendingMessages.set(clientMsgId, {
      data,
      timestamp: Date.now(),
      attempts: 1
    });
    
    try {
      const response = await fetch(`${this.messageUrl}?sessionId=${this.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Message-Id': clientMsgId
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      // Get server message ID from response header
      const serverMsgId = response.headers.get('X-Message-Id');
      if (serverMsgId) {
        // Update pending message with server ID
        const pending = this.pendingMessages.get(clientMsgId);
        if (pending) {
          this.pendingMessages.delete(clientMsgId);
          this.pendingMessages.set(serverMsgId, pending);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      // Keep in pending messages for potential retry
      throw error;
    }
  }
  
  async acknowledgeMessage(messageId) {
    if (!this.sessionId) return;
    
    try {
      await fetch(`${this.messageUrl}?sessionId=${this.sessionId}&ack=true&messageId=${messageId}`, {
        method: 'POST'
      });
      console.log(`Message ${messageId} acknowledged`);
    } catch (error) {
      console.error(`Failed to acknowledge message ${messageId}:`, error);
    }
  }
  
  async checkPendingMessages() {
    if (!this.sessionId) return;
    
    try {
      const response = await fetch(`${this.messageUrl}?sessionId=${this.sessionId}&reconnect=true`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.pendingMessages && result.pendingMessages.length > 0) {
        console.log(`Received ${result.pendingMessages.length} pending messages after reconnection`);
        
        // Process pending messages
        result.pendingMessages.forEach(msg => {
          this.onMessage(msg.payload);
          this.acknowledgeMessage(msg.messageId);
        });
      }
    } catch (error) {
      console.error('Error checking pending messages:', error);
    }
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.connected = false;
      this.sessionId = null;
      console.log('Disconnected from SSE endpoint');
    }
  }
}

export default EnhancedSSEClient; 