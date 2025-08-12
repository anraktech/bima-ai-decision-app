const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Add CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Serve the demo HTML file
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const content = fs.readFileSync(path.join(__dirname, 'demo.html'), 'utf8');
      res.writeHead(200, { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
      console.log('✅ Served demo.html successfully');
    } catch (error) {
      console.error('❌ Error reading demo.html:', error);
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
  console.log(`✅ Also try: http://127.0.0.1:${port}/`);
  console.log('📁 Serving demo.html with professional design');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} is in use. Trying port ${port + 1}...`);
    server.listen(port + 1, '127.0.0.1');
  }
});