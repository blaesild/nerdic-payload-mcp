import * as http from 'http';

console.log('Testing SSE connection with heartbeat monitoring');
console.log('This test will run for 2 minutes to observe heartbeats');
console.log('Press Ctrl+C to stop');

const options = {
  hostname: 'localhost',
  port: 8090,
  path: '/sse',
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
  }
};

const startTime = Date.now();
const testDuration = 2 * 60 * 1000; // 2 minutes
let heartbeatCount = 0;

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  res.on('data', (chunk) => {
    const data = chunk.toString();
    console.log(`RECEIVED: ${data}`);
    
    // Count heartbeats
    if (data.includes('heartbeat')) {
      heartbeatCount++;
      console.log(`Heartbeat count: ${heartbeatCount}`);
    }
    
    // Check if the test duration has elapsed
    if (Date.now() - startTime > testDuration) {
      console.log(`Test completed. Observed ${heartbeatCount} heartbeats in ${testDuration / 1000} seconds`);
      process.exit(0);
    }
  });
  
  res.on('end', () => {
    console.log('Connection closed by server');
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// End the request
req.end(); 