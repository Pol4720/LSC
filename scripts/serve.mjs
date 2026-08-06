#!/usr/bin/env node
/**
 * LSC · Zero-dependency static server for local development and e2e tests.
 * The app is a plain static site, so this is all the tooling it needs.
 *
 *   node scripts/serve.mjs [port] [--prefix=/LSC]
 *
 * --prefix mirrors how GitHub Pages serves a project site from a subpath, so
 * the e2e suite can prove the app never assumes it lives at the domain root.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const PREFIX = (process.argv.find((a) => a.startsWith('--prefix=')) || '')
  .replace('--prefix=', '').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (PREFIX) {
      if (path === PREFIX) { res.writeHead(301, { Location: `${PREFIX}/` }).end(); return; }
      if (!path.startsWith(`${PREFIX}/`)) { res.writeHead(404).end('404 Not Found'); return; }
      path = path.slice(PREFIX.length);
    }
    if (path.endsWith('/')) path += 'index.html';

    let file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 Not Found'); return; }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(e.message || e));
  }
});

server.listen(PORT, () => console.log(`LSC dev server → http://localhost:${PORT}${PREFIX}/`));
