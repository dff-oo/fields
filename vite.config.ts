import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';
import { fieldMapPng } from './field-map';

const root = fileURLToPath(new URL('.', import.meta.url));
const RESOURCE_FILES = ['characters', 'enemies', 'abilities', 'items', 'summons', 'fields', 'stages', 'talks', 'missions'];

function resourcesDir(): string {
  for (const region of ['gb', 'jp']) {
    const directory = resolve(root, 'resources', region);
    if (existsSync(resolve(directory, 'characters.json'))) return directory;
  }
  return resolve(root, 'resources/gb');
}

function sendJson(res: { setHeader: (name: string, value: string) => void; end: (body: string) => void }, body: unknown): void {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Serves the extracted names and field paintings from the local machine. Story files are opened and saved in the browser. */
function localContent(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    if (req.method !== 'GET' || !req.url?.startsWith('/builder-api')) {
      next();
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/builder-api/resources') {
      const directory = resourcesDir();
      const payload: Record<string, unknown> = {};
      for (const name of RESOURCE_FILES) {
        const path = resolve(directory, `${name}.json`);
        payload[name] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
      }
      sendJson(res, payload);
      return;
    }
    const fieldMap = /^\/builder-api\/field-map\/(\d+)$/.exec(url.pathname);
    if (fieldMap) {
      try {
        const map = fieldMapPng(root, Number(fieldMap[1]));
        if (!map) {
          res.statusCode = 404;
          res.end('no field map in the local archive');
          return;
        }
        res.setHeader('content-type', 'image/png');
        res.setHeader('X-Field-Scale', String(map.scaleX));
        res.end(map.png);
      } catch (error) {
        res.statusCode = 500;
        res.end(error instanceof Error ? error.message : 'field map failed');
      }
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
}

export default defineConfig({
  plugins: [react(), { name: 'local-content', configureServer: localContent }],
  resolve: {
    alias: { zod: resolve(root, 'node_modules/zod') },
  },
  server: {
    port: 5173,
    fs: { allow: ['.'] },
  },
});
