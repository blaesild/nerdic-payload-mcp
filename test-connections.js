import * as http from 'http';

console.log('Testing connections endpoint at http://localhost:8090/connections');
console.log('Press Ctrl+C to stop');

const options = {
  hostname: 'localhost',
  port: 8090,
  path: '/connections',
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE DATA:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('Could not parse JSON:', data);
      console.error(e);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// End the request
req.end(); 