// src/tracker/query.ts
// 查询：按月 / 按 provider / 按天时间序列 / 最近记录

import type { Database as Db } from 'better-sqlite3';
import type { CallRecord, DailyStats, ModelStat, MonthlyStats, ProviderStat } from '../types.js';
import { monthStartTs, monthEndTs } from '../utils/format.js';

export function getCallsByMonth(db: Db, month: string): CallRecord[] {
  const start = monthStartTs(month);
  const end = monthEndTs(month);
  const rows = db
    .prepare(
      `SELECT * FROM call_records
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC`
    )
    .all(start, end) as CallRecordRow[];
  return rows.map(toCallRecord);
}

export function getMonthlyStats(db: Db, month: string): MonthlyStats {
  const start = monthStartTs(month);
  const end = monthEndTs(month);

  // 总览
  const totalRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_cny), 0) AS totalCost,
         COALESCE(SUM(total_tokens), 0) AS totalTokens,
         COUNT(*) AS totalCalls
       FROM call_records
       WHERE timestamp >= ? AND timestamp <= ? AND status = 'success'`
    )
    .get(start, end) as { totalCost: number; totalTokens: number; totalCalls: number };

  // 按 provider
  const providerRows = db
    .prepare(
      `SELECT
         provider,
         COALESCE(SUM(cost_cny), 0) AS cost,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         COUNT(*) AS calls
       FROM call_records
       WHERE timestamp >= ? AND timestamp <= ? AND status = 'success'
       GROUP BY provider
       ORDER BY cost DESC`
    )
    .all(start, end) as Array<{
    provider: string;
    cost: number;
    tokens: number;
    calls: number;
  }>;

  const totalCost = totalRow.totalCost;
  const byProvider: ProviderStat[] = providerRows.map((r) => ({
    provider: r.provider,
    costCNY: r.cost,
    totalTokens: r.tokens,
    callCount: r.calls,
    percentage: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
  }));

  // 按 model
  const modelRows = db
    .prepare(
      `SELECT
         provider, model,
         COALESCE(SUM(cost_cny), 0) AS cost,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         COUNT(*) AS calls
       FROM call_records
       WHERE timestamp >= ? AND timestamp <= ? AND status = 'success'
       GROUP BY provider, model
       ORDER BY cost DESC
       LIMIT 20`
    )
    .all(start, end) as Array<{
    provider: string;
    model: string;
    cost: number;
    tokens: number;
    calls: number;
  }>;

  const byModel: ModelStat[] = modelRows.map((r) => ({
    provider: r.provider,
    model: r.model,
    costCNY: r.cost,
    totalTokens: r.tokens,
    callCount: r.calls,
  }));

  return {
    month,
    totalCostCNY: totalCost,
    totalTokens: totalRow.totalTokens,
    totalCalls: totalRow.totalCalls,
    byProvider,
    byModel,
  };
}

export function getDailyStats(db: Db, month: string): DailyStats[] {
  const start = monthStartTs(month);
  const end = monthEndTs(month);
  // 用 SQLite 内置 date() 函数（带 localtime）把 timestamp 转成 'YYYY-MM-DD'
  // 然后 GROUP BY 拿到 daily 聚合
  // 这是最可靠的本地时区分组方法（避免 UNIX 整除边界问题）
  const rows = db
    .prepare(
      `SELECT
         date(timestamp / 1000, 'unixepoch', 'localtime') AS day,
         COALESCE(SUM(cost_cny), 0) AS cost,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         COUNT(*) AS calls
       FROM call_records
       WHERE timestamp >= ? AND timestamp <= ? AND status = 'success'
       GROUP BY day
       ORDER BY day`
    )
    .all(start, end) as Array<{
    day: string;
    cost: number;
    tokens: number;
    calls: number;
  }>;

  return rows.map((r) => ({
    date: r.day,
    costCNY: r.cost,
    totalTokens: r.tokens,
    callCount: r.calls,
  }));
}

export function getRecentCalls(db: Db, limit = 20): CallRecord[] {
  const rows = db
    .prepare(`SELECT * FROM call_records ORDER BY timestamp DESC LIMIT ?`)
    .all(limit) as CallRecordRow[];
  return rows.map(toCallRecord);
}

// --- internal helpers ---

interface CallRecordRow {
  id: number;
  timestamp: number;
  provider: string;
  model: string;
  upstream_model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_cny: number;
  duration_ms: number;
  status: 'success' | 'error';
  error_message: string | null;
  skill_hint: string | null;
}

function toCallRecord(row: CallRecordRow): CallRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    provider: row.provider,
    model: row.model,
    upstreamModel: row.upstream_model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    costCNY: row.cost_cny,
    durationMs: row.duration_ms,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    skillHint: row.skill_hint ?? undefined,
  };
}
