const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3007;
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    filePath = path.normalize(filePath);
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => console.log(`Mets Tracker running at http://localhost:${PORT}`));
