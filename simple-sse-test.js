import * as http from 'http';

console.log('Testing SSE connection to http://localhost:8090/sse');
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

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  res.on('data', (chunk) => {
    console.log(`RECEIVED: ${chunk.toString()}`);
  });
  
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// End the request
req.end(); 