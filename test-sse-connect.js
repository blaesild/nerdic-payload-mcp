// ESM syntax
import * as EventSourceModule from 'eventsource';
const EventSource = EventSourceModule.default || EventSourceModule;

console.log('Connecting to SSE endpoint...');

// Create an EventSource connection to the SSE endpoint
const eventSource = new EventSource('http://localhost:8090/sse');

// Handle successful connection
eventSource.onopen = (event) => {
  console.log('SSE connection opened successfully');
};

// Handle messages
eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);
    
    // If we get a session ID, we've successfully connected
    if (data.type === 'connection' && data.status === 'established') {
      console.log(`Session established with ID: ${data.sessionId}`);
      
      // Close the connection after 2 seconds to test cleanup
      setTimeout(() => {
        console.log('Closing connection...');
        eventSource.close();
        console.log('Connection closed');
        
        // Exit the process after another second
        setTimeout(() => {
          console.log('Test completed successfully');
          process.exit(0);
        }, 1000);
      }, 2000);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
};

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
};

// Set a timeout to exit if we don't connect
setTimeout(() => {
  console.error('Timed out waiting for connection');
  eventSource.close();
  process.exit(1);
}, 10000); 