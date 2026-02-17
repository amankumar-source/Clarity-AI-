const http = require('http');

const data = JSON.stringify({
    text: "Testing connectivity."
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/clarify',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => {
    console.error(`ERROR: ${e.message}`);
});

req.write(data);
req.end();
