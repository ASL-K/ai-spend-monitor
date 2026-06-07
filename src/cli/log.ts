// src/cli/log.ts
// aism log: 最近 N 条调用记录

import type { Database as Db } from 'better-sqlite3';
import { getRecentCalls } from '../tracker/query.js';
import { formatCNY, formatNumber, formatTimestamp } from '../utils/format.js';
import type { Config } from '../types.js';

export function logCommand(db: Db, _config: Config, limit: number): void {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const records = getRecentCalls(db, safeLimit);

  console.log();
  console.log(`最近 ${records.length} 条调用记录`);
  console.log('─'.repeat(80));

  if (records.length === 0) {
    console.log('暂无调用记录');
    console.log();
    return;
  }

  // 表头
  console.log(
    [
      '时间'.padEnd(20),
      'Provider'.padEnd(12),
      'Model'.padEnd(28),
      'Tokens'.padStart(10),
      '成本'.padStart(10),
      '耗时'.padStart(8),
    ].join('  ')
  );
  console.log('─'.repeat(80));

  for (const r of records) {
    const modelShort = r.model.length > 26 ? r.model.slice(0, 25) + '…' : r.model;
    const costStr = r.status === 'error' ? 'ERR' : formatCNY(r.costCNY);
    const durStr = r.status === 'error' ? '—' : `${r.durationMs}ms`;
    console.log(
      [
        formatTimestamp(r.timestamp).padEnd(20),
        r.provider.padEnd(12),
        modelShort.padEnd(28),
        formatNumber(r.totalTokens).padStart(10),
        costStr.padStart(10),
        durStr.padStart(8),
      ].join('  ')
    );

    if (r.status === 'error' && r.errorMessage) {
      console.log(`  ↳ error: ${r.errorMessage}`);
    }
  }
  console.log();
}
