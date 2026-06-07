// src/cli/today.ts
// aism today: 今日成本

import type { Database as Db } from 'better-sqlite3';
import { formatCNY, formatNumber } from '../utils/format.js';
import type { Config } from '../types.js';

export function todayCommand(db: Db, _config: Config): void {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();
  const endTs = Date.now();

  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_cny), 0) AS cost,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         COUNT(*) AS calls
       FROM call_records
       WHERE timestamp >= ? AND timestamp <= ? AND status = 'success'`
    )
    .get(startTs, endTs) as { cost: number; tokens: number; calls: number };

  console.log();
  console.log(`今日 AI 成本（${startOfDay.toISOString().slice(0, 10)}）`);
  console.log('─'.repeat(40));
  console.log(`总成本        ${formatCNY(row.cost)}`);
  console.log(`调用次数      ${formatNumber(row.calls)} 次`);
  console.log(`总 tokens     ${formatNumber(row.tokens)}`);
  console.log('─'.repeat(40));

  if (row.calls === 0) {
    console.log('今日还没调用记录');
  } else {
    const avg = row.cost / row.calls;
    console.log(`平均每次      ${formatCNY(avg)}`);
  }
  console.log();
}
