// src/tracker/insert.ts
// 写入调用记录

import type { Database as Db } from 'better-sqlite3';
import type { CallRecord } from '../types.js';

export function insertCall(db: Db, record: Omit<CallRecord, 'id'>): number {
  const stmt = db.prepare(`
    INSERT INTO call_records (
      timestamp, provider, model, upstream_model,
      prompt_tokens, completion_tokens, total_tokens,
      cost_cny, duration_ms, status, error_message, skill_hint
    ) VALUES (
      @timestamp, @provider, @model, @upstreamModel,
      @promptTokens, @completionTokens, @totalTokens,
      @costCNY, @durationMs, @status, @errorMessage, @skillHint
    )
  `);
  const result = stmt.run({
    timestamp: record.timestamp,
    provider: record.provider,
    model: record.model,
    upstreamModel: record.upstreamModel,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    totalTokens: record.totalTokens,
    costCNY: record.costCNY,
    durationMs: record.durationMs,
    status: record.status,
    errorMessage: record.errorMessage ?? null,
    skillHint: record.skillHint ?? null,
  });
  return Number(result.lastInsertRowid);
}

/**
 * 写一条客户端错误记录（400 路径：JSON 解析失败 / 缺字段 / provider 推断不出）
 * 不调上游 API，没有 token 消耗，costCNY=0，durationMs≈0
 * provider 写 'unknown'（无 header 上下文），model 写收到的或空
 */
export function insertClientError(
  db: Db,
  errorMessage: string,
  model: string = ''
): number {
  return insertCall(db, {
    timestamp: Date.now(),
    provider: 'unknown',
    model: model || '(no model)',
    upstreamModel: model || '(no model)',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costCNY: 0,
    durationMs: 0,
    status: 'error',
    errorMessage,
  });
}

/** 批量插入（用于导入历史数据，v0.1 不上 UI） */
export function insertCalls(db: Db, records: Array<Omit<CallRecord, 'id'>>): number {
  const stmt = db.prepare(`
    INSERT INTO call_records (
      timestamp, provider, model, upstream_model,
      prompt_tokens, completion_tokens, total_tokens,
      cost_cny, duration_ms, status, error_message, skill_hint
    ) VALUES (
      @timestamp, @provider, @model, @upstreamModel,
      @promptTokens, @completionTokens, @totalTokens,
      @costCNY, @durationMs, @status, @errorMessage, @skillHint
    )
  `);
  const insertMany = db.transaction((rows: Array<Omit<CallRecord, 'id'>>) => {
    for (const r of rows) {
      stmt.run({
        timestamp: r.timestamp,
        provider: r.provider,
        model: r.model,
        upstreamModel: r.upstreamModel,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
        costCNY: r.costCNY,
        durationMs: r.durationMs,
        status: r.status,
        errorMessage: r.errorMessage ?? null,
        skillHint: r.skillHint ?? null,
      });
    }
  });
  insertMany(records);
  return records.length;
}
