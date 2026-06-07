// tests/providers/base.test.ts
import { describe, it, expect } from 'vitest';
import { BaseProvider } from '../../src/providers/base.js';

class TestProvider extends BaseProvider {
  readonly name = 'test';
  readonly displayName = 'Test';
  readonly baseUrl = 'https://api.test.com/v1';
}

describe('BaseProvider.extractApiKey', () => {
  const p = new TestProvider();

  it('extracts from Bearer header', () => {
    expect(p.extractApiKey('Bearer sk-abc123')).toBe('sk-abc123');
  });

  it('is case-insensitive on Bearer', () => {
    expect(p.extractApiKey('bearer sk-abc')).toBe('sk-abc');
    expect(p.extractApiKey('BEARER sk-abc')).toBe('sk-abc');
  });

  it('trims whitespace', () => {
    expect(p.extractApiKey('Bearer  sk-abc  ')).toBe('sk-abc');
  });

  it('returns empty for undefined', () => {
    expect(p.extractApiKey(undefined)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(p.extractApiKey('')).toBe('');
  });

  it('returns empty when no Bearer prefix (security)', () => {
    expect(p.extractApiKey('sk-abc')).toBe('');
    expect(p.extractApiKey('Basic xyz')).toBe('');
  });
});

describe('BaseProvider.extractUsage (OpenAI compat)', () => {
  const p = new TestProvider();

  it('extracts from standard OpenAI response', () => {
    const body = {
      id: 'chatcmpl-xxx',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
    expect(p.extractUsage(body)).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('returns zeros when usage missing', () => {
    expect(p.extractUsage({ id: 'xxx' })).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('returns zeros for null body', () => {
    expect(p.extractUsage(null)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('handles partial usage object', () => {
    expect(p.extractUsage({ usage: { prompt_tokens: 10 } })).toEqual({
      promptTokens: 10,
      completionTokens: 0,
      totalTokens: 0,
    });
  });
});

describe('BaseProvider.normalizeModel (default passthrough)', () => {
  const p = new TestProvider();

  it('returns model as-is', () => {
    expect(p.normalizeModel('gpt-4o')).toBe('gpt-4o');
    expect(p.normalizeModel('MiniMax-Text-01')).toBe('MiniMax-Text-01');
  });
});
