// tests/tracker/query.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, closeDb } from '../../src/tracker/db.js';
import { insertCall } from '../../src/tracker/insert.js';
import { getCallsByMonth, getMonthlyStats, getDailyStats } from '../../src/tracker/query.js';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('query.getMonthlyStats', () => {
  const testDbPath = join(tmpdir(), `ai-spend-query-test-${Date.now()}.db`);

  beforeEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  it('aggregates total cost, tokens, calls', () => {
    const db = openDb(testDbPath);
    try {
      const now = Date.now();
      insertCall(db, {
        timestamp: now, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
        promptTokens: 100, completionTokens: 50, totalTokens: 150, costCNY: 0.5, durationMs: 100, status: 'success',
      });
      insertCall(db, {
        timestamp: now, provider: 'minimax', model: 'MiniMax-Text-01', upstreamModel: 'MiniMax-Text-01',
        promptTokens: 200, completionTokens: 100, totalTokens: 300, costCNY: 0.3, durationMs: 100, status: 'success',
      });
      insertCall(db, {
        timestamp: now, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 0, durationMs: 100, status: 'error',
      });

      const month = new Date(now).toISOString().slice(0, 7);
      const stats = getMonthlyStats(db, month);
      expect(stats.totalCostCNY).toBeCloseTo(0.8, 5);
      expect(stats.totalTokens).toBe(450);
      expect(stats.totalCalls).toBe(2); // 错误的不计入
    } finally {
      closeDb(db);
    }
  });

  it('breaks down by provider with percentage', () => {
    const db = openDb(testDbPath);
    try {
      const now = Date.now();
      insertCall(db, {
        timestamp: now, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 7, durationMs: 0, status: 'success',
      });
      insertCall(db, {
        timestamp: now, provider: 'minimax', model: 'MiniMax-Text-01', upstreamModel: 'MiniMax-Text-01',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 3, durationMs: 0, status: 'success',
      });

      const month = new Date(now).toISOString().slice(0, 7);
      const stats = getMonthlyStats(db, month);
      expect(stats.byProvider).toHaveLength(2);
      const ds = stats.byProvider.find((p) => p.provider === 'deepseek');
      const mm = stats.byProvider.find((p) => p.provider === 'minimax');
      expect(ds?.percentage).toBeCloseTo(70, 1);
      expect(mm?.percentage).toBeCloseTo(30, 1);
    } finally {
      closeDb(db);
    }
  });

  it('breaks down by model', () => {
    const db = openDb(testDbPath);
    try {
      const now = Date.now();
      insertCall(db, {
        timestamp: now, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 5, durationMs: 0, status: 'success',
      });
      insertCall(db, {
        timestamp: now, provider: 'deepseek', model: 'deepseek-reasoner', upstreamModel: 'deepseek-reasoner',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 10, durationMs: 0, status: 'success',
      });

      const month = new Date(now).toISOString().slice(0, 7);
      const stats = getMonthlyStats(db, month);
      expect(stats.byModel).toHaveLength(2);
      const top = stats.byModel[0];
      expect(top?.model).toBe('deepseek-reasoner'); // 贵的排前面
      expect(top?.costCNY).toBe(10);
    } finally {
      closeDb(db);
    }
  });

  it('returns empty stats for month with no calls', () => {
    const db = openDb(testDbPath);
    try {
      const stats = getMonthlyStats(db, '2025-01');
      expect(stats.totalCostCNY).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.byProvider).toHaveLength(0);
    } finally {
      closeDb(db);
    }
  });
});

describe('query.getCallsByMonth', () => {
  const testDbPath = join(tmpdir(), `ai-spend-month-test-${Date.now()}.db`);

  beforeEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  it('only returns calls within the specified month', () => {
    const db = openDb(testDbPath);
    try {
      // 2026-06 的一条
      const june = new Date(2026, 5, 15).getTime();
      insertCall(db, {
        timestamp: june, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 1, durationMs: 0, status: 'success',
      });
      // 2026-05 的一条
      const may = new Date(2026, 4, 15).getTime();
      insertCall(db, {
        timestamp: may, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 2, durationMs: 0, status: 'success',
      });

      const juneCalls = getCallsByMonth(db, '2026-06');
      const mayCalls = getCallsByMonth(db, '2026-05');
      expect(juneCalls).toHaveLength(1);
      expect(juneCalls[0]?.costCNY).toBe(1);
      expect(mayCalls).toHaveLength(1);
      expect(mayCalls[0]?.costCNY).toBe(2);
    } finally {
      closeDb(db);
    }
  });
});

describe('query.getDailyStats', () => {
  const testDbPath = join(tmpdir(), `ai-spend-daily-test-${Date.now()}.db`);

  beforeEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  it('groups by day', () => {
    const db = openDb(testDbPath);
    try {
      // 2026-06-07 3 笔
      const d1 = new Date(2026, 5, 7, 9).getTime();
      const d2 = new Date(2026, 5, 7, 14).getTime();
      const d3 = new Date(2026, 5, 7, 20).getTime();
      // 2026-06-08 1 笔
      const d4 = new Date(2026, 5, 8, 10).getTime();

      for (const ts of [d1, d2, d3, d4]) {
        insertCall(db, {
          timestamp: ts, provider: 'deepseek', model: 'deepseek-chat', upstreamModel: 'deepseek-chat',
          promptTokens: 0, completionTokens: 0, totalTokens: 0, costCNY: 1, durationMs: 0, status: 'success',
        });
      }

      const stats = getDailyStats(db, '2026-06');
      expect(stats).toHaveLength(2);
      const day1 = stats.find((s) => s.date === '2026-06-07');
      const day2 = stats.find((s) => s.date === '2026-06-08');
      expect(day1?.callCount).toBe(3);
      expect(day1?.costCNY).toBeCloseTo(3, 5);
      expect(day2?.callCount).toBe(1);
    } finally {
      closeDb(db);
    }
  });
});
