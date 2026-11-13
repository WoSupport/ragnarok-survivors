import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 5173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === '/') pathname = '/index.html';

    const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!safePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      console.warn(`[404] ${req.method} ${pathname}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const stat = fs.statSync(safePath);
    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutableBinary =
      pathname.startsWith('/assets/') && ext !== '.json';
    const cacheHeader = isImmutableBinary
      ? 'public, max-age=86400'
      : 'no-store, no-cache, must-revalidate';

    if (!isImmutableBinary) {
      console.log(`[200] ${req.method} ${req.url}`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      if (Number.isNaN(start) || start >= stat.size || end >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
        'Cache-Control': cacheHeader,
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(safePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Cache-Control': cacheHeader,
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(safePath).pipe(res);
    }
  } catch (err) {
    console.error('[500]', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ragnarok Survivors running at http://localhost:${PORT}`);
});
