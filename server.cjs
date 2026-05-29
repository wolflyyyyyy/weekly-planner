// SPA-friendly static server for production
// Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5188;
const DIST = path.join(__dirname, 'dist');
const INDEX = path.join(DIST, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    // File not found, serve index.html for SPA fallback
    const html = fs.readFileSync(INDEX);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let filePath = path.join(DIST, url.pathname);

  // If path has no extension, treat as SPA route → serve index.html
  const ext = path.extname(url.pathname);
  if (!ext || ext === '') {
    filePath = INDEX;
  }

  serveFile(res, filePath);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Network: http://0.0.0.0:${PORT}/`);
});
