// src/pricing/calculator.ts
// 成本计算器

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PriceEntry, PriceTable } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedTable: PriceTable | null = null;

function loadTable(): PriceTable {
  if (cachedTable) return cachedTable;
  const tablePath = join(__dirname, 'table.json');
  const content = readFileSync(tablePath, 'utf-8');
  cachedTable = JSON.parse(content) as PriceTable;
  return cachedTable;
}

export function findPrice(provider: string, model: string): PriceEntry | undefined {
  const table = loadTable();
  return table.prices.find(
    (p) => p.provider.toLowerCase() === provider.toLowerCase() && p.model === model
  );
}

/**
 * 计算一次调用的成本（人民币）
 * - 找不到价格表条目时返回 0（不抛错，避免破坏"记录"完整性）
 * - token=0 时返回 0
 */
export function calculateCostCNY(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const price = findPrice(provider, model);
  if (!price) return 0;
  // 注意: 价格为 per 1k token
  const inputCost = (promptTokens / 1000) * price.inputPer1kCNY;
  const outputCost = (completionTokens / 1000) * price.outputPer1kCNY;
  return inputCost + outputCost;
}

export function getTable(): PriceTable {
  return loadTable();
}
