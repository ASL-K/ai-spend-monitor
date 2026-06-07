// tests/pricing/calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCostCNY, findPrice, getTable } from '../../src/pricing/calculator.js';

describe('findPrice', () => {
  it('finds deepseek-chat price', () => {
    const p = findPrice('deepseek', 'deepseek-chat');
    expect(p).toBeDefined();
    expect(p?.inputPer1kCNY).toBe(0.002);
    expect(p?.outputPer1kCNY).toBe(0.003);
  });

  it('finds minimax price', () => {
    const p = findPrice('minimax', 'MiniMax-Text-01');
    expect(p).toBeDefined();
    expect(p?.inputPer1kCNY).toBe(0.001);
  });

  it('returns undefined for unknown model', () => {
    expect(findPrice('deepseek', 'gpt-4o')).toBeUndefined();
  });

  it('is case-insensitive on provider', () => {
    const p = findPrice('DeepSeek', 'deepseek-chat');
    expect(p).toBeDefined();
  });
});

describe('calculateCostCNY', () => {
  it('calculates 1M input + 1M output for deepseek-chat', () => {
    // deepseek-chat: 0.002 / 0.003 per 1k
    // 1M input = 1000 * 0.002 = 2 元
    // 1M output = 1000 * 0.003 = 3 元
    // total = 5 元
    const cost = calculateCostCNY('deepseek', 'deepseek-chat', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(5.0, 5);
  });

  it('calculates small amounts correctly', () => {
    // 100 input + 50 output
    // 0.1 * 0.002 + 0.05 * 0.003 = 0.0002 + 0.00015 = 0.00035
    const cost = calculateCostCNY('deepseek', 'deepseek-chat', 100, 50);
    expect(cost).toBeCloseTo(0.00035, 8);
  });

  it('returns 0 for unknown model', () => {
    expect(calculateCostCNY('deepseek', 'unknown-model', 1000, 1000)).toBe(0);
  });

  it('returns 0 for 0 tokens', () => {
    expect(calculateCostCNY('deepseek', 'deepseek-chat', 0, 0)).toBe(0);
  });

  it('handles only input', () => {
    const cost = calculateCostCNY('minimax', 'MiniMax-Text-01', 1000, 0);
    expect(cost).toBeCloseTo(0.001, 8);
  });

  it('handles only output', () => {
    const cost = calculateCostCNY('minimax', 'MiniMax-Text-01', 0, 1000);
    expect(cost).toBeCloseTo(0.001, 8);
  });
});

describe('getTable', () => {
  it('returns the full table', () => {
    const t = getTable();
    expect(t.version).toBeDefined();
    expect(t.usdToCNY).toBeGreaterThan(0);
    expect(t.prices.length).toBeGreaterThan(0);
  });
});
