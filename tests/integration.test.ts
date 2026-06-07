// tests/integration.test.ts
// 端到端集成测试: 启动 main() → POST /v1/chat/completions → 验证 SQLite 写入
// mock fetch 全局替换,避免真打 DeepSeek/MiniMax API

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

describe('main entry: end-to-end proxy + SQLite', () => {
  const testDbPath = join(tmpdir(), `ai-spend-int-${Date.now()}.db`);
  let realFetch: typeof fetch;
  let mockResponses: Array<{ status: number; body: string }> = [];
  let mockCalls: Array<{ url: string; init: RequestInit | undefined }> = [];

  beforeEach(async () => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
    realFetch = globalThis.fetch;
    mockResponses = [];
    mockCalls = [];
    // 替换 fetch：碰到 deepseek.com / minimaxi.com 就返回 mock
    globalThis.fetch = vi.fn(async (url, init) => {
      const u = url.toString();
      mockCalls.push({ url: u, init });
      const r = mockResponses.shift() ?? { status: 500, body: '{"error":"no mock"}' };
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = realFetch;
    // 关闭 main() 启动的 server
    const { runningServer, runningDb } = await import('../src/index.js');
    if (runningServer) runningServer.close();
    if (runningDb) runningDb.close();
    // 等待 server 关闭
    await new Promise((r) => setTimeout(r, 100));
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  it('POST proxy → 200 → SQLite record inserted with costCNY', async () => {
    // 准备 mock 响应（DeepSeek 的真实格式）
    mockResponses.push({
      status: 200,
      body: JSON.stringify({
        id: 'chatcmpl-mock-1',
        model: 'deepseek-chat',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
    });

    // 启动主服务
    const { main } = await import('../src/index.js');
    const config = loadConfig({
      dbPath: testDbPath,
      port: 0,
      host: '127.0.0.1',
      logLevel: 'silent',
    });
    // main() 不会返回，我们用 Promise.race 抢到 server port
    let mainDone = false;
    const mainPromise = main(config).catch(() => {}).then(() => { mainDone = true; });

    // 等 server 起来
    let port = 0;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const { runningServer } = await import('../src/index.js');
      if (runningServer) {
        port = runningServer.port;
        break;
      }
    }
    expect(port).toBeGreaterThan(0);

    // POST 一次
    const res = await realFetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-fake-deepseek-key',
        'x-provider': 'deepseek',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usage.total_tokens).toBe(150);

    // 验证 fetch 被调了 (mock fetch) — 检查调用了 deepseek URL
    const deepseekCall = mockCalls.find((c) => c.url.includes('deepseek.com'));
    expect(deepseekCall).toBeDefined();
    expect(deepseekCall?.init?.method).toBe('POST');

    // 验证 SQLite 写入
    await new Promise((r) => setTimeout(r, 100));
    const { openDb, closeDb } = await import('../src/tracker/db.js');
    const { getRecentCalls } = await import('../src/tracker/query.js');
    const db = openDb(testDbPath);
    try {
      const records = getRecentCalls(db, 10);
      expect(records).toHaveLength(1);
      expect(records[0]?.provider).toBe('deepseek');
      expect(records[0]?.status).toBe('success');
      expect(records[0]?.promptTokens).toBe(100);
      expect(records[0]?.completionTokens).toBe(50);
      expect(records[0]?.totalTokens).toBe(150);
      // costCNY: deepseek-chat 0.002/1k input + 0.003/1k output
      // 100/1000 * 0.002 + 50/1000 * 0.003 = 0.0002 + 0.00015 = 0.00035
      expect(records[0]?.costCNY).toBeCloseTo(0.00035, 8);
    } finally {
      closeDb(db);
    }

    // 优雅退出（用 SIGINT 走 on handler 关闭 server）
    // 但 main() 永远不会自然返回；让测试自己 cleanup 即可
    void mainPromise;
  });

  it('POST without x-provider but model starts with deepseek → routes to deepseek', async () => {
    mockResponses.push({
      status: 200,
      body: JSON.stringify({
        model: 'deepseek-chat',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const { main } = await import('../src/index.js');
    const config = loadConfig({
      dbPath: testDbPath,
      port: 0,
      host: '127.0.0.1',
      logLevel: 'silent',
    });
    void main(config).catch(() => {});

    let port = 0;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const { runningServer } = await import('../src/index.js');
      if (runningServer) {
        port = runningServer.port;
        break;
      }
    }

    const res = await realFetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-fake',
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // 无 x-provider，靠 model 推断
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(200);
    expect(mockCalls[0]?.url).toContain('deepseek.com');
  });

  it('POST with unknown model → 400', async () => {
    const { main } = await import('../src/index.js');
    const config = loadConfig({
      dbPath: testDbPath,
      port: 0,
      host: '127.0.0.1',
      logLevel: 'silent',
    });
    void main(config).catch(() => {});

    let port = 0;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const { runningServer } = await import('../src/index.js');
      if (runningServer) {
        port = runningServer.port;
        break;
      }
    }

    const res = await realFetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-fake',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 不知道是哪个 provider
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(400);
  });
});
