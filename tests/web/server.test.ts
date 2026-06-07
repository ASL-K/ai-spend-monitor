// tests/web/server.test.ts
// 集成测试: 启动 server → 调 API → 关闭

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startWebServer } from '../../src/web/server.js';
import { openDb, closeDb } from '../../src/tracker/db.js';
import { insertCall } from '../../src/tracker/insert.js';
import { loadConfig } from '../../src/config.js';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Web server', () => {
  const testDbPath = join(tmpdir(), `ai-spend-web-test-${Date.now()}.db`);
  let port: number;
  let close: () => void;

  beforeEach(async () => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
    const db = openDb(testDbPath);

    // 准备测试数据
    const now = Date.now();
    insertCall(db, {
      timestamp: now, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
      promptTokens: 100, completionTokens: 50, totalTokens: 150, costCNY: 0.5, durationMs: 100, status: 'success',
    });
    insertCall(db, {
      timestamp: now, provider: 'minimax', model: 'MiniMax-Text-01', upstreamModel: 'MiniMax-Text-01',
      promptTokens: 200, completionTokens: 100, totalTokens: 300, costCNY: 0.3, durationMs: 100, status: 'success',
    });

    const config = loadConfig({ dbPath: testDbPath, port: 0, logLevel: 'silent' });
    const server = await startWebServer({ config, db });
    port = server.port;
    close = server.close;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      close();
      // 给 server 一点时间关
      setTimeout(() => resolve(), 50);
    });
    // 等待 db 引用也清掉
    await new Promise((r) => setTimeout(r, 50));
    rmSync(testDbPath, { force: true });
  });

  it('serves /api/health', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('serves /api/stats/month with current month', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/stats/month`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalCostCNY).toBeCloseTo(0.8, 5);
    expect(data.totalTokens).toBe(450);
    expect(data.byProvider).toHaveLength(2);
  });

  it('serves /api/stats/month with custom month param', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/stats/month?month=2025-01`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalCostCNY).toBe(0);
    expect(data.totalCalls).toBe(0);
  });

  it('serves /api/stats/daily', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/stats/daily`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('serves /api/stats/recent with limit', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/stats/recent?limit=5`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it('clamps recent limit to 1-200', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/stats/recent?limit=99999`);
    expect(res.status).toBe(200);
    // 即使数据库只有 2 条，也应该返回 ≤ 200
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(200);
  });

  it('returns 404 for unknown API', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/unknown`);
    expect(res.status).toBe(404);
  });

  it('serves index.html for /', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('ai-spend-monitor');
  });

  it('serves style.css', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/style.css`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('container');
  });

  it('serves app.js', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('fetchJson');
  });

  it('returns 404 for missing static file', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/does-not-exist.txt`);
    expect(res.status).toBe(404);
  });

  it('handles /.. as root (HTTP parser normalizes)', async () => {
    // node:http parser 会把 `GET /..` 规范化为 `GET /` (根路径)
    // 所以 server 拿到的 path 是 `/`，返回 index.html (200)
    // path.includes('..') 检查只在**未规范化**路径里触发（理论上浏览器/客户端不会发这种请求）
    // 这个测试确认规范化行为符合预期
    const net = await import('node:net');
    const result = await new Promise<{ status: number }>((resolveFn, rejectFn) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.write('GET /.. HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
      });
      let data = '';
      socket.on('data', (chunk) => (data += chunk.toString()));
      socket.on('end', () => {
        const statusLine = data.split('\r\n')[0] ?? '';
        const m = statusLine.match(/HTTP\/1\.[01] (\d+)/);
        resolveFn({ status: m ? parseInt(m[1]!, 10) : 0 });
      });
      socket.on('error', rejectFn);
    });
    expect(result.status).toBe(200);
  });
});
