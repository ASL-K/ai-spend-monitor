// tests/tracker/insert-client-error.test.ts
// 覆盖 3 个 400 路径的 helper: insertClientError
// 关键: provider='unknown' (非真实 AI 调用), costCNY=0, durationMs=0, status='error'
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, closeDb } from '../../src/tracker/db.js';
import { insertCall, insertClientError } from '../../src/tracker/insert.js';
import { getRecentCalls } from '../../src/tracker/query.js';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('insertClientError (400 路径 helper)', () => {
  const testDbPath = join(tmpdir(), `ai-spend-test-client-error-${Date.now()}.db`);

  beforeEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  it('缺字段路径: 不传 model → 写 (no model) + provider=unknown', () => {
    const db = openDb(testDbPath);
    try {
      const before = Date.now();
      const id = insertClientError(db, 'Missing required fields: model, messages');
      const after = Date.now();

      expect(id).toBeGreaterThan(0);

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(1);
      const r = calls[0]!;
      expect(r.provider).toBe('unknown');
      expect(r.model).toBe('(no model)');
      expect(r.upstreamModel).toBe('(no model)');
      expect(r.status).toBe('error');
      expect(r.costCNY).toBe(0);
      expect(r.durationMs).toBe(0);
      expect(r.promptTokens).toBe(0);
      expect(r.completionTokens).toBe(0);
      expect(r.totalTokens).toBe(0);
      expect(r.errorMessage).toBe('Missing required fields: model, messages');
      expect(r.timestamp).toBeGreaterThanOrEqual(before);
      expect(r.timestamp).toBeLessThanOrEqual(after);
    } finally {
      closeDb(db);
    }
  });

  it('provider 推断失败路径: 传 model 名 → 保留 model + provider=unknown', () => {
    const db = openDb(testDbPath);
    try {
      const id = insertClientError(
        db,
        'Cannot determine provider. Set x-provider header (deepseek/minimax).',
        'unknownmodel-xyz'
      );
      expect(id).toBeGreaterThan(0);

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(1);
      const r = calls[0]!;
      expect(r.provider).toBe('unknown');
      expect(r.model).toBe('unknownmodel-xyz');
      expect(r.upstreamModel).toBe('unknownmodel-xyz');
      expect(r.errorMessage).toContain('Cannot determine provider');
    } finally {
      closeDb(db);
    }
  });

  it('JSON 解析失败路径: 错误信息完整保留', () => {
    const db = openDb(testDbPath);
    try {
      const rawErrMsg = `Invalid JSON body: Unexpected token 'o', "not json at all" is not valid JSON`;
      insertClientError(db, rawErrMsg);

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(1);
      const r = calls[0]!;
      expect(r.provider).toBe('unknown');
      expect(r.model).toBe('(no model)');
      expect(r.errorMessage).toBe(rawErrMsg);
    } finally {
      closeDb(db);
    }
  });

  it('混合: 真实 AI 401 error + 客户端 400 error 共存 → 都写入, 区分清楚', () => {
    const db = openDb(testDbPath);
    try {
      // 真实 AI 401 (从 insertCall 写, 不走 helper)
      insertCall(db, {
        timestamp: Date.now(),
        provider: 'minimax',
        model: 'MiniMax-Text-01',
        upstreamModel: 'MiniMax-Text-01',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costCNY: 0,
        durationMs: 660,
        status: 'error',
        errorMessage: 'HTTP 401',
      });

      // 客户端 400
      insertClientError(db, 'Missing required fields: model, messages', 'MiniMax-Text-01');

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(2);

      // 401 是真实 AI 错误, provider=minimax, durationMs=660
      const aiErr = calls.find((c) => c.provider === 'minimax')!;
      expect(aiErr.status).toBe('error');
      expect(aiErr.errorMessage).toBe('HTTP 401');
      expect(aiErr.durationMs).toBe(660);

      // 400 是客户端错误, provider=unknown, durationMs=0
      const clientErr = calls.find((c) => c.provider === 'unknown')!;
      expect(clientErr.status).toBe('error');
      expect(clientErr.errorMessage).toBe('Missing required fields: model, messages');
      expect(clientErr.durationMs).toBe(0);
      expect(clientErr.model).toBe('MiniMax-Text-01');
    } finally {
      closeDb(db);
    }
  });
});
