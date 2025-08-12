const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Serve the demo HTML file
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const content = fs.readFileSync(path.join(__dirname, 'demo.html'), 'utf8');
      res.writeHead(200, { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    } catch (error) {
      res.writeHead(404);
      res.end('File not found');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const port = 8888;
server.listen(port, '127.0.0.1', () => {
  console.log(`✅ Server running at http://localhost:${port}/`);
  console.log(`✅ Try this URL: http://127.0.0.1:${port}/`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});