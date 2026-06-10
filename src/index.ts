// src/index.ts
// 主入口: HTTP server 统一服务 (静态文件 + API + 反向代理)
//
// 路由:
//   GET  /                       → 静态 index.html
//   GET  /<file>                 → 静态文件 (style.css / app.js)
//   GET  /api/health             → 健康检查
//   GET  /api/stats/month?month=YYYY-MM   → 本月统计
//   GET  /api/stats/daily?month=YYYY-MM   → 按天时间序列
//   GET  /api/stats/recent?limit=N        → 最近 N 条
//   POST /v1/chat/completions    → OpenAI 兼容反向代理
//   POST /v1/*                   → 透传到默认 provider (不写库, 兜底)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { openDb, closeDb } from './tracker/db.js';
import { insertCall } from './tracker/insert.js';
import { getMonthlyStats, getDailyStats, getRecentCalls } from './tracker/query.js';
import { calculateCostCNY } from './pricing/calculator.js';
import { handleProxy } from './proxy/handler.js';
import { listProviders } from './providers/registry.js';
import { currentMonth } from './utils/format.js';
import { logger } from './utils/logger.js';
import { ProxyError } from './utils/errors.js';
import type { Config } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = resolve(__dirname, 'web', 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

interface RunningServer {
  port: number;
  close: () => void;
}

// 暴露给测试用
export let runningServer: RunningServer | null = null;
let runningDb: ReturnType<typeof openDb> | null = null;

/** 主入口函数 (被 bin/ai-spend-monitor.js 调用) */
export async function main(overrides: Partial<Config> = {}): Promise<void> {
  const config = loadConfig(overrides);
  logger.configure(config);
  logger.info(`ai-spend-monitor v0.1.0 starting`);
  logger.info(`Listening on http://${config.host}:${config.port}`);
  logger.info(`Database: ${config.dbPath}`);
  logger.info(`Providers: ${listProviders().map((p) => p.name).join(', ')}`);

  const db = openDb(config.dbPath);
  runningDb = db;

  const server = createServer((req, res) => {
    void handleRequest(req, res, config, db);
  });

  await new Promise<void>((resolveFn) => {
    server.listen(config.port, config.host, () => resolveFn());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : config.port;

  runningServer = {
    port,
    close: () => {
      server.close();
    },
  };

  logger.info(`Dashboard: http://${config.host}:${port}`);
  logger.info(`Proxy:     http://${config.host}:${port}/v1/chat/completions`);
  logger.info(`Press Ctrl+C to stop`);

  // 优雅关闭
  const shutdown = (): void => {
    logger.info('Shutting down...');
    if (runningServer) runningServer.close();
    if (runningDb) closeDb(runningDb);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // 保持进程活着
  await new Promise(() => {});
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
  db: ReturnType<typeof openDb>
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  try {
    // 1. API routes
    if (path.startsWith('/api/')) {
      return await handleApi(path, url, res, db);
    }

    // 2. Proxy routes
    if (path.startsWith('/v1/') && method === 'POST') {
      return await handleProxyRoute(req, res, config, db);
    }

    // 3. Static files
    if (method === 'GET') {
      return await handleStatic(path, res);
    }

    jsonResponse(res, 405, { error: 'Method not allowed', method, path });
  } catch (err) {
    logger.error(`Request error on ${method} ${path}: ${(err as Error).message}`);
    if (err instanceof ProxyError) {
      jsonResponse(res, err.statusCode, { error: err.message, provider: err.provider });
    } else {
      jsonResponse(res, 500, { error: 'Internal server error', message: (err as Error).message });
    }
  }
}

async function handleApi(
  path: string,
  url: URL,
  res: ServerResponse,
  db: ReturnType<typeof openDb>
): Promise<void> {
  let data: unknown;
  if (path === '/api/health') {
    data = { status: 'ok', version: '0.1.0', providers: listProviders().map((p) => p.name) };
  } else if (path === '/api/stats/month') {
    const month = url.searchParams.get('month') ?? currentMonth();
    data = getMonthlyStats(db, month);
  } else if (path === '/api/stats/daily') {
    const month = url.searchParams.get('month') ?? currentMonth();
    data = getDailyStats(db, month);
  } else if (path === '/api/stats/recent') {
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    data = getRecentCalls(db, Math.min(Math.max(limit, 1), 200));
  } else {
    jsonResponse(res, 404, { error: 'Not found', path });
    return;
  }
  jsonResponse(res, 200, data);
}

async function handleProxyRoute(
  req: IncomingMessage,
  res: ServerResponse,
  _config: Config,
  db: ReturnType<typeof openDb>
): Promise<void> {
  // 1. 读 body
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks).toString('utf-8');

  let body: { model?: string; messages?: unknown[]; stream?: boolean; [key: string]: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    jsonResponse(res, 400, { error: 'Invalid JSON body', message: (err as Error).message });
    return;
  }

  if (!body.model || !Array.isArray(body.messages)) {
    jsonResponse(res, 400, { error: 'Missing required fields: model, messages' });
    return;
  }

  // 2. 决定 provider: 优先 x-provider header, 否则从 model 前缀推断
  const headerProvider = req.headers['x-provider'];
  let provider: string | undefined;
  if (typeof headerProvider === 'string' && headerProvider.length > 0) {
    provider = headerProvider;
  } else {
    // 从 model 推断: 'deepseek-chat' → 'deepseek', 'MiniMax-Text-01' → 'minimax'
    const lower = body.model.toLowerCase();
    if (lower.startsWith('deepseek') || lower.startsWith('qwen')) provider = 'deepseek';
    else if (lower.startsWith('minimax') || lower.startsWith('abab')) provider = 'minimax';
  }

  if (!provider) {
    jsonResponse(res, 400, {
      error: 'Cannot determine provider. Set x-provider header (deepseek/minimax).',
    });
    return;
  }

  // 3. 转发
  const result = await handleProxy({
    provider,
    authHeader: req.headers.authorization,
    body: {
      model: body.model,
      messages: body.messages as Array<{ role: string; content: string | unknown[] }>,
      stream: body.stream,
    },
  });

  // 4. 计算成本 + 写库
  if (result.record.status === 'success') {
    const costCNY = calculateCostCNY(
      result.record.provider,
      result.record.upstreamModel,
      result.record.promptTokens,
      result.record.completionTokens
    );
    result.record.costCNY = costCNY;
  }
  insertCall(db, result.record);

  // 5. 透传响应
  res.statusCode = result.statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(result.responseBody);
}

async function handleStatic(path: string, res: ServerResponse): Promise<void> {
  let filePath = path === '/' ? '/index.html' : path;
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

// 如果直接 node dist/index.js 跑（不通过 bin），也支持
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error(`Fatal: ${err.message}`);
    process.exit(1);
  });
}
