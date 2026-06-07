// src/cli/status.ts
// aism status: 本月总览

import type { Database as Db } from 'better-sqlite3';
import { getMonthlyStats } from '../tracker/query.js';
import { currentMonth, formatCNY, formatNumber } from '../utils/format.js';
import type { Config } from '../types.js';

export function statusCommand(db: Db, config: Config): void {
  const month = currentMonth();
  const stats = getMonthlyStats(db, month);

  console.log();
  console.log(`本月 AI 成本（${month}）`);
  console.log('─'.repeat(40));
  console.log(`总成本        ${formatCNY(stats.totalCostCNY)} / ${formatCNY(config.budgetCNY)}（套餐）`);

  const remaining = config.budgetCNY - stats.totalCostCNY;
  console.log(`剩余预算      ${formatCNY(Math.max(remaining, 0))}`);

  const pct = config.budgetCNY > 0 ? (stats.totalCostCNY / config.budgetCNY) * 100 : 0;
  console.log(`使用比例      ${pct.toFixed(1)}%`);
  console.log('─'.repeat(40));

  if (stats.byProvider.length === 0) {
    console.log('按 Provider 拆解: 暂无数据');
  } else {
    console.log('按 Provider 拆解:');
    for (const p of stats.byProvider) {
      const bar = '█'.repeat(Math.round(p.percentage / 5));
      console.log(
        `  ${p.provider.padEnd(14)} ${formatCNY(p.costCNY).padStart(10)}   ${p.percentage.toFixed(1).padStart(5)}%  ${bar}`
      );
    }
  }

  console.log('─'.repeat(40));
  console.log(`调用次数      ${formatNumber(stats.totalCalls)} 次`);
  console.log(`总 tokens     ${formatNumber(stats.totalTokens)}`);

  if (stats.totalCalls > 0) {
    const avg = stats.totalCostCNY / stats.totalCalls;
    console.log(`平均每次      ${formatCNY(avg)}`);
  }
  console.log();
}
