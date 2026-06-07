// src/web/server.ts
// HTTP server: 静态文件 + 3 个 stats API
//
// 注意: 这个文件**不**包含代理逻辑
// 代理逻辑在 src/index.ts 整合时挂到 /v1/* 路径
// 这里只管 / (静态) + /api/* (统计)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as Db } from 'better-sqlite3';
import { getMonthlyStats, getDailyStats, getRecentCalls } from '../tracker/query.js';
import { currentMonth } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export interface WebServerOptions {
  config: Config;
  db: Db;
}

export function startWebServer(opts: WebServerOptions): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleRequest(req, res, opts);
    });
    server.on('error', reject);
    server.listen(opts.config.port, opts.config.host, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : opts.config.port;
      logger.info(`Web server listening on http://${opts.config.host}:${port}`);
      resolve({
        port,
        close: () => {
          server.close();
        },
      });
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: WebServerOptions
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  // API routes
  if (path.startsWith('/api/')) {
    return handleApi(path, url, res, opts);
  }

  // Static files
  return handleStatic(path, res);
}

async function handleApi(
  path: string,
  url: URL,
  res: ServerResponse,
  opts: WebServerOptions
): Promise<void> {
  try {
    let data: unknown;
    if (path === '/api/stats/month') {
      const month = url.searchParams.get('month') ?? currentMonth();
      data = getMonthlyStats(opts.db, month);
    } else if (path === '/api/stats/daily') {
      const month = url.searchParams.get('month') ?? currentMonth();
      data = getDailyStats(opts.db, month);
    } else if (path === '/api/stats/recent') {
      const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
      data = getRecentCalls(opts.db, Math.min(Math.max(limit, 1), 200));
    } else if (path === '/api/health') {
      data = { status: 'ok', version: '0.0.3' };
    } else {
      jsonResponse(res, 404, { error: 'Not found', path });
      return;
    }
    jsonResponse(res, 200, data);
  } catch (err) {
    logger.error(`API error on ${path}: ${(err as Error).message}`);
    jsonResponse(res, 500, { error: 'Internal server error', message: (err as Error).message });
  }
}

async function handleStatic(path: string, res: ServerResponse): Promise<void> {
  // Default to index.html
  let filePath = path === '/' ? '/index.html' : path;
  // 防 path traversal
  if (filePath.includes('..')) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  const fullPath = join(PUBLIC_DIR, filePath);
  try {
    const s = await stat(fullPath);
    if (!s.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = extname(fullPath);
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    const content = await readFile(fullPath);
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
