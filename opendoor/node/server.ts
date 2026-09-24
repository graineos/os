// SPDX-License-Identifier: GPL-2.0-only

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.env['ANGEL_NODE_PORT'] ?? process.env['PORT'] ?? 4174);
const host = process.env['ANGEL_NODE_HOST'] ?? '0.0.0.0';
const publicDir = resolve(process.env['ANGEL_NODE_PUBLIC_DIR'] ?? '.output/public');
const release = process.env['ANGEL_RELEASE_ID'] ?? process.env['GITHUB_SHA'] ?? 'development';
const startedAt = Date.now();

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function safePath(urlPath: string) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '').replace(/^\.\.([/\\]|$)/g, '');
  const candidate = resolve(join(publicDir, relative));
  return candidate.startsWith(publicDir) ? candidate : null;
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveFile(res: import('node:http').ServerResponse, path: string) {
  const stat = statSync(path);
  if (!stat.isFile()) return false;
  const type = contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Angel-Node': '1',
    'X-Angel-Release': release,
  });
  createReadStream(path).pipe(res);
  return true;
}

export const angelNodeServer = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url.startsWith('/api/angel-node/health')) {
    return json(res, 200, {
      service: 'angel-node',
      layer: 'angel-os',
      healthy: true,
      release,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      publicDir,
      publicDirReady: existsSync(publicDir),
      angelOsIaRequired: false,
    });
  }

  if (!existsSync(publicDir)) {
    return json(res, 503, { service: 'angel-node', healthy: false, reason: 'public_build_missing', publicDir });
  }

  const candidate = safePath(url);
  if (candidate && existsSync(candidate)) {
    try { if (serveFile(res, candidate)) return; } catch { /* SPA fallback below */ }
  }

  const indexPath = join(publicDir, 'index.html');
  if (existsSync(indexPath)) {
    try { if (serveFile(res, indexPath)) return; } catch { /* error below */ }
  }

  json(res, 404, { service: 'angel-node', error: 'not_found' });
});

export function startAngelNode() {
  return angelNodeServer.listen(port, host, () => {
    console.info(`[angel-node] listening on http://${host}:${port} release=${release} public=${publicDir}`);
  });
}

if (process.env['ANGEL_NODE_AUTOSTART'] === '1') startAngelNode();
