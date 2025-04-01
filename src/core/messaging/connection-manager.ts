import { Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { messageQueue } from './message-queue.js';

// Connection tracking with timestamps and health info
export interface ConnectionInfo {
  transport: SSEServerTransport;
  createdAt: Date;
  lastActive: Date;
  heartbeatCount: number;
  reconnectAttempts: number;
  res: Response;
}

// Connection manager constants
export const CONNECTION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

export class ConnectionManager {
  // Store active connections
  private connections: Map<string, ConnectionInfo> = new Map();
  
  // Store heartbeat intervals
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Get all connections
  getConnections(): Map<string, ConnectionInfo> {
    return this.connections;
  }
  
  // Get connection by sessionId
  getConnection(sessionId: string): ConnectionInfo | undefined {
    return this.connections.get(sessionId);
  }
  
  // Add a new connection
  addConnection(transport: SSEServerTransport, res: Response): ConnectionInfo {
    const connectionInfo: ConnectionInfo = {
      transport,
      createdAt: new Date(),
      lastActive: new Date(),
      heartbeatCount: 0,
      reconnectAttempts: 0,
      res
    };
    
    this.connections.set(transport.sessionId, connectionInfo);
    
    // Do not send headers directly here - the transport will handle this
    // Instead, we'll just set up event listeners
    
    // Set up cleanup handlers
    res.on('close', () => {
      console.log(`[DEBUG] Client disconnected: ${transport.sessionId}`);
      this.cleanupConnection(transport.sessionId);
    });
    
    res.on('error', (err) => {
      console.error(`[ERROR] Connection error for ${transport.sessionId}:`, err);
      this.cleanupConnection(transport.sessionId);
    });
    
    // Start heartbeat
    this.startHeartbeat(transport.sessionId);
    
    return connectionInfo;
  }
  
  // Update connection last active time
  updateActivity(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.lastActive = new Date();
    }
  }
  
  // Clean up a connection and associated resources
  cleanupConnection(sessionId: string): void {
    // Clear heartbeat interval
    if (this.heartbeatIntervals.has(sessionId)) {
      clearInterval(this.heartbeatIntervals.get(sessionId));
      this.heartbeatIntervals.delete(sessionId);
    }
    
    // Remove from connection tracking
    this.connections.delete(sessionId);
    console.log(`[DEBUG] Connection ${sessionId} fully cleaned up`);
  }
  
  // Get connection statistics
  getStats() {
    const now = Date.now();
    
    return {
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(([sessionId, info]) => ({
        sessionId,
        createdAt: info.createdAt,
        lastActive: info.lastActive,
        heartbeatCount: info.heartbeatCount,
        ageSeconds: Math.floor((now - info.createdAt.getTime()) / 1000),
        inactiveSeconds: Math.floor((now - info.lastActive.getTime()) / 1000)
      }))
    };
  }
  
  // Start heartbeat for a connection
  private startHeartbeat(sessionId: string): void {
    const heartbeatInterval = setInterval(() => {
      const connection = this.connections.get(sessionId);
      if (!connection || connection.res.writableEnded) {
        clearInterval(heartbeatInterval);
        this.cleanupConnection(sessionId);
        return;
      }
      
      try {
        // Send heartbeat
        connection.res.write(`data: ${JSON.stringify({ 
          type: 'heartbeat', 
          timestamp: new Date().toISOString() 
        })}\n\n`);
        
        // Update connection info
        connection.heartbeatCount++;
        
        // Check for timeout
        const inactiveTime = Date.now() - connection.lastActive.getTime();
        if (inactiveTime > CONNECTION_TIMEOUT_MS) {
          console.log(`[DEBUG] Connection timeout for ${sessionId}`);
          clearInterval(heartbeatInterval);
          this.cleanupConnection(sessionId);
        }
      } catch (error) {
        console.error(`[ERROR] Heartbeat error for ${sessionId}:`, error);
        clearInterval(heartbeatInterval);
        this.cleanupConnection(sessionId);
      }
    }, HEARTBEAT_INTERVAL_MS);
    
    // Store interval reference
    this.heartbeatIntervals.set(sessionId, heartbeatInterval);
  }
}

// Create a singleton instance
export const connectionManager = new ConnectionManager(); 