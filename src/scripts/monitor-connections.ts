import axios from 'axios';

/**
 * Utility script to monitor active SSE connections
 */
async function monitorConnections() {
  try {
    const response = await axios.get('http://localhost:8090/connections');
    
    console.clear();
    console.log('----- CONNECTION MONITOR -----');
    console.log(`Active Connections: ${response.data.activeConnections}`);
    console.log('\nConnection Details:');
    
    if (response.data.connections.length === 0) {
      console.log('No active connections');
    } else {
      console.table(response.data.connections.map((conn: any) => ({
        SessionID: conn.sessionId.substring(0, 8) + '...',
        'Created At': new Date(conn.createdAt).toLocaleTimeString(),
        'Last Active': new Date(conn.lastActive).toLocaleTimeString(),
        'Age (sec)': conn.ageSeconds,
        'Inactive (sec)': conn.inactiveSeconds,
        'Heartbeats': conn.heartbeatCount
      })));
    }
    
    // Message queue statistics
    const queueResponse = await axios.get('http://localhost:8090/message-queue/stats');
    console.log('\n----- MESSAGE QUEUE -----');
    console.log(`Total messages: ${queueResponse.data.totalMessages}`);
    console.log(`Acknowledged: ${queueResponse.data.acknowledgedMessages}`);
    console.log(`Unacknowledged: ${queueResponse.data.unacknowledgedMessages}`);
    
  } catch (error) {
    console.error('Error monitoring connections:', error);
  }
}

// Run every 5 seconds
setInterval(monitorConnections, 5000);
monitorConnections();

console.log('Connection monitor started. Press Ctrl+C to exit.'); 