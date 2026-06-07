// tests/tracker/insert.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, closeDb } from '../../src/tracker/db.js';
import { insertCall, insertCalls } from '../../src/tracker/insert.js';
import { getRecentCalls } from '../../src/tracker/query.js';
import type { CallRecord } from '../../src/types.js';
import { unlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('tracker insert + query', () => {
  const testDbPath = join(tmpdir(), `ai-spend-test-${Date.now()}.db`);

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  it('inserts and reads back a success record', () => {
    const db = openDb(testDbPath);
    try {
      const id = insertCall(db, {
        timestamp: Date.now(),
        provider: 'deepseek',
        model: 'deepseek-chat',
        upstreamModel: 'deepseek-chat',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costCNY: 0.0005,
        durationMs: 1234,
        status: 'success',
      });
      expect(id).toBeGreaterThan(0);

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        provider: 'deepseek',
        model: 'deepseek-chat',
        promptTokens: 100,
        completionTokens: 50,
        status: 'success',
      });
    } finally {
      closeDb(db);
    }
  });

  it('inserts error record with message', () => {
    const db = openDb(testDbPath);
    try {
      insertCall(db, {
        timestamp: Date.now(),
        provider: 'minimax',
        model: 'MiniMax-Text-01',
        upstreamModel: 'MiniMax-Text-01',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costCNY: 0,
        durationMs: 500,
        status: 'error',
        errorMessage: 'HTTP 401',
      });

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.status).toBe('error');
      expect(calls[0]?.errorMessage).toBe('HTTP 401');
    } finally {
      closeDb(db);
    }
  });

  it('inserts in batch with transaction', () => {
    const db = openDb(testDbPath);
    try {
      const records: Array<Omit<CallRecord, 'id'>> = [];
      for (let i = 0; i < 100; i++) {
        records.push({
          timestamp: Date.now() - i * 1000,
          provider: i % 2 === 0 ? 'deepseek' : 'minimax',
          model: i % 2 === 0 ? 'deepseek-chat' : 'MiniMax-Text-01',
          upstreamModel: 'x',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          costCNY: 0.0001,
          durationMs: 100,
          status: 'success',
        });
      }
      const n = insertCalls(db, records);
      expect(n).toBe(100);

      const calls = getRecentCalls(db, 200);
      expect(calls).toHaveLength(100);
    } finally {
      closeDb(db);
    }
  });

  it('orders recent calls by timestamp DESC', () => {
    const db = openDb(testDbPath);
    try {
      const now = Date.now();
      insertCall(db, {
        timestamp: now - 2000,
        provider: 'deepseek',
        model: 'deepseek-chat',
        upstreamModel: 'deepseek-chat',
        promptTokens: 1, completionTokens: 1, totalTokens: 2, costCNY: 0, durationMs: 1, status: 'success',
      });
      insertCall(db, {
        timestamp: now - 1000,
        provider: 'deepseek',
        model: 'deepseek-chat',
        upstreamModel: 'deepseek-chat',
        promptTokens: 1, completionTokens: 1, totalTokens: 2, costCNY: 0, durationMs: 1, status: 'success',
      });
      insertCall(db, {
        timestamp: now,
        provider: 'deepseek',
        model: 'deepseek-chat',
        upstreamModel: 'deepseek-chat',
        promptTokens: 1, completionTokens: 1, totalTokens: 2, costCNY: 0, durationMs: 1, status: 'success',
      });

      const calls = getRecentCalls(db, 10);
      expect(calls).toHaveLength(3);
      // 第一个应该是最新的
      expect(calls[0]?.timestamp).toBe(now);
      expect(calls[2]?.timestamp).toBe(now - 2000);
    } finally {
      closeDb(db);
    }
  });
});
