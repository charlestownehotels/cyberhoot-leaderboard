// Minimal dependency-free static server for public/.
// Serves the leaderboard on your internal network. Do NOT expose publicly —
// public/data/leaderboard.json contains employee names, emails, and scores.
//
// Usage: node server.mjs   (env: PORT, HOST)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Resolve within ROOT; block path traversal.
    let filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const body = await readFile(filePath);
    const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    // Never let the data JSON be cached stale.
    const cache = filePath.endsWith('.json') ? 'no-store' : 'no-cache';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache }).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Server error');
    console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CyberHoot Leaderboard: http://localhost:${PORT}  (serving ${ROOT})`);
});
