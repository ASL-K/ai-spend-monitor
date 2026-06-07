// tests/providers/registry.test.ts
import { describe, it, expect } from 'vitest';
import {
  getProvider,
  listProviders,
  registerProvider,
} from '../../src/providers/registry.js';
import { BaseProvider } from '../../src/providers/base.js';

describe('Provider Registry', () => {
  it('returns deepseek provider', () => {
    const p = getProvider('deepseek');
    expect(p).toBeDefined();
    expect(p?.name).toBe('deepseek');
    expect(p?.baseUrl).toBe('https://api.deepseek.com/v1');
  });

  it('returns minimax provider', () => {
    const p = getProvider('minimax');
    expect(p).toBeDefined();
    expect(p?.name).toBe('minimax');
    expect(p?.baseUrl).toBe('https://api.minimaxi.com/v1');
  });

  it('is case-insensitive', () => {
    expect(getProvider('DeepSeek')?.name).toBe('deepseek');
    expect(getProvider('MINIMAX')?.name).toBe('minimax');
  });

  it('returns undefined for unknown provider', () => {
    expect(getProvider('unknown')).toBeUndefined();
  });

  it('lists all registered providers', () => {
    const all = listProviders();
    expect(all).toHaveLength(2);
    const names = all.map((p) => p.name).sort();
    expect(names).toEqual(['deepseek', 'minimax']);
  });

  it('allows registering a new provider', () => {
    class TestProvider extends BaseProvider {
      readonly name = 'test-provider';
      readonly displayName = 'Test';
      readonly baseUrl = 'https://api.test.com/v1';
    }
    registerProvider(new TestProvider());
    expect(getProvider('test-provider')).toBeDefined();
    expect(listProviders()).toHaveLength(3);
  });
});
