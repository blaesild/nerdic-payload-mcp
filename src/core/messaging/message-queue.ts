import { EventEmitter } from 'events';

interface QueuedMessage {
  id: string;
  sessionId: string;
  payload: any;
  timestamp: Date;
  attempts: number;
  acknowledged: boolean;
}

export class MessageQueue extends EventEmitter {
  private messages: Map<string, QueuedMessage> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_INTERVAL_MS = 5000;
  private queueProcessor: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.startQueueProcessor();
  }
  
  // Add message to queue
  enqueue(sessionId: string, payload: any): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const message: QueuedMessage = {
      id,
      sessionId,
      payload,
      timestamp: new Date(),
      attempts: 0,
      acknowledged: false
    };
    
    this.messages.set(id, message);
    this.emit('messageQueued', message);
    
    return id;
  }
  
  // Mark message as acknowledged
  acknowledge(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (message) {
      message.acknowledged = true;
      this.emit('messageAcknowledged', message);
      // Clean up after acknowledgment
      setTimeout(() => {
        this.messages.delete(messageId);
      }, 5000);
      return true;
    }
    return false;
  }
  
  // Get unacknowledged messages for a session
  getUnacknowledgedMessages(sessionId: string): QueuedMessage[] {
    return Array.from(this.messages.values())
      .filter(msg => msg.sessionId === sessionId && !msg.acknowledged);
  }
  
  // Get statistics about the queue
  getStats() {
    const totalMessages = this.messages.size;
    const acknowledgedMessages = Array.from(this.messages.values())
      .filter(msg => msg.acknowledged).length;
    const unacknowledgedMessages = totalMessages - acknowledgedMessages;
    
    return {
      totalMessages,
      acknowledgedMessages,
      unacknowledgedMessages
    };
  }
  
  // Stop the queue processor
  stop() {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }
  }
  
  // Process the queue periodically
  private startQueueProcessor() {
    this.queueProcessor = setInterval(() => {
      const now = Date.now();
      
      for (const [id, message] of this.messages.entries()) {
        // Skip acknowledged messages
        if (message.acknowledged) continue;
        
        // Check if it's time to retry
        const messageAge = now - message.timestamp.getTime();
        if (messageAge > this.RETRY_INTERVAL_MS && message.attempts < this.MAX_RETRIES) {
          message.attempts++;
          this.emit('messageRetry', message);
        } else if (message.attempts >= this.MAX_RETRIES) {
          // Message delivery failed after max retries
          this.emit('messageDeliveryFailed', message);
          this.messages.delete(id);
        }
      }
    }, 1000);
  }
}

// Create a singleton instance
export const messageQueue = new MessageQueue(); 