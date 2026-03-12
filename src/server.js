import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { scanFiles } from './scanner.js';
import { renderMarkdown } from './renderer.js';
import { buildSidebar } from './sidebar.js';
import { createWatcher } from './watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

/**
 * Create a Hono HTTP server with API routes and static file serving.
 * @param {string} rootPath - The root directory containing markdown files.
 * @param {object} [options={}] - Optional settings.
 * @param {string[]} [options.ignore] - Additional glob patterns to ignore.
 * @returns {Promise<{app: Hono, start: (port: number) => void}>}
 */
export async function createServer(rootPath, options = {}) {
  const absoluteRoot = path.resolve(rootPath);
  const ignorePatterns = options.ignore || [];
  const app = new Hono();

  // --- API routes ---

  app.get('/api/files', async (c) => {
    const files = await scanFiles(absoluteRoot, { ignore: ignorePatterns });
    const tree = buildSidebar(files);
    return c.json(tree);
  });

  app.get('/api/file', async (c) => {
    const filePath = c.req.query('path');

    if (!filePath) {
      return c.json({ error: 'Missing path query parameter' }, 400);
    }

    // Security: prevent path traversal outside rootPath
    const resolved = path.resolve(absoluteRoot, filePath);
    if (!resolved.startsWith(absoluteRoot + path.sep) && resolved !== absoluteRoot) {
      return c.json({ error: 'Invalid path' }, 403);
    }

    try {
      const content = await fs.readFile(resolved, 'utf-8');
      const html = renderMarkdown(content);
      return c.json({ html, path: filePath });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return c.json({ error: 'File not found' }, 404);
      }
      throw err;
    }
  });

  // --- Search index API (client-side MiniSearch) ---

  app.get('/api/search-index', async (c) => {
    const files = await scanFiles(absoluteRoot, { ignore: ignorePatterns });
    const docs = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        docs.push({
          id: file.relativePath,
          path: file.relativePath,
          name: file.name,
          content,
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return c.json(docs);
  });

  // --- Static file serving ---

  const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };

  // Serve minisearch UMD from node_modules (resolve main entry, then find UMD sibling)
  const minisearchMain = fileURLToPath(import.meta.resolve('minisearch'));
  const minisearchPath = path.join(path.dirname(minisearchMain), '..', 'umd', 'index.js');
  app.get('/vendor/minisearch.js', async (c) => {
    const content = await fs.readFile(minisearchPath);
    return c.body(content, 200, { 'Content-Type': 'text/javascript' });
  });

  app.get('/', async (c) => {
    const html = await fs.readFile(path.join(publicDir, 'index.html'), 'utf-8');
    return c.html(html);
  });

  // Serve static files from public/ at root URLs (e.g. /style.css → public/style.css)
  app.get('/*', async (c, next) => {
    const filePath = path.join(publicDir, c.req.path);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(publicDir)) {
      return next();
    }
    try {
      const content = await fs.readFile(resolved);
      const ext = path.extname(resolved);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      return c.body(content, 200, { 'Content-Type': contentType });
    } catch {
      return next();
    }
  });

  // --- Start function ---

  function start(port) {
    const server = serve({
      fetch: app.fetch,
      port,
    }, (info) => {
      console.log(`http://localhost:${info.port}`);
    });

    // Phase 2: WebSocket live reload
    const wss = new WebSocketServer({ server });

    createWatcher(absoluteRoot, (event, filePath) => {
      const message = JSON.stringify({ type: 'reload', event, path: filePath });
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          client.send(message);
        }
      }
    });
  }

  return { app, start };
}
