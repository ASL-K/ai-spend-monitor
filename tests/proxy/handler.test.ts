// tests/proxy/handler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleProxy } from '../../src/proxy/handler.js';
import { UnknownProviderError, MissingApiKeyError } from '../../src/utils/errors.js';

describe('handleProxy - validation', () => {
  it('throws UnknownProviderError for unknown provider', async () => {
    await expect(
      handleProxy({
        provider: 'unknown',
        authHeader: 'Bearer sk-test',
        body: { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] },
      })
    ).rejects.toThrow(UnknownProviderError);
  });

  it('throws MissingApiKeyError for deepseek without auth', async () => {
    await expect(
      handleProxy({
        provider: 'deepseek',
        authHeader: undefined,
        body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
      })
    ).rejects.toThrow(MissingApiKeyError);
  });

  it('throws for empty Bearer', async () => {
    await expect(
      handleProxy({
        provider: 'minimax',
        authHeader: 'Bearer ',
        body: { model: 'MiniMax-Text-01', messages: [{ role: 'user', content: 'hi' }] },
      })
    ).rejects.toThrow(MissingApiKeyError);
  });

  it('rejects stream mode in v0.1', async () => {
    // Note: stream check happens AFTER provider/apiKey validation
    // So we need a valid provider + key first
    await expect(
      handleProxy({
        provider: 'deepseek',
        authHeader: 'Bearer sk-test',
        body: {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          stream: true,
        },
      })
    ).rejects.toThrow(/Stream mode is not supported/);
  });
});

describe('handleProxy - upstream fetch (mocked)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('forwards to correct provider URL with correct headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'chatcmpl-xxx',
          model: 'deepseek-chat',
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    globalThis.fetch = mockFetch;

    const result = await handleProxy({
      provider: 'deepseek',
      authHeader: 'Bearer sk-real-key',
      body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(result.statusCode).toBe(200);
    expect(result.record.provider).toBe('deepseek');
    expect(result.record.upstreamModel).toBe('deepseek-chat');
    expect(result.record.promptTokens).toBe(10);
    expect(result.record.completionTokens).toBe(20);
    expect(result.record.totalTokens).toBe(30);
    expect(result.record.status).toBe('success');

    // 验证 fetch 被正确调用
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-real-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('records error on upstream 4xx/5xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{"error": "invalid api key"}', { status: 401 })
    );

    const result = await handleProxy({
      provider: 'deepseek',
      authHeader: 'Bearer sk-bad',
      body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(result.statusCode).toBe(401);
    expect(result.record.status).toBe('error');
    expect(result.record.errorMessage).toBe('HTTP 401');
    expect(result.record.promptTokens).toBe(0);
  });

  it('records error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await handleProxy({
      provider: 'minimax',
      authHeader: 'Bearer sk-test',
      body: { model: 'MiniMax-Text-01', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(result.statusCode).toBe(502);
    expect(result.record.status).toBe('error');
    expect(result.record.errorMessage).toBe('ECONNREFUSED');
  });

  it('handles missing usage in response gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'xxx', choices: [] }), { status: 200 })
    );

    const result = await handleProxy({
      provider: 'deepseek',
      authHeader: 'Bearer sk-test',
      body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(result.statusCode).toBe(200);
    expect(result.record.status).toBe('success');
    expect(result.record.totalTokens).toBe(0);
  });

  it('records durationMs accurately', async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(
                  JSON.stringify({
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                  }),
                  { status: 200 }
                )
              ),
            50
          );
        })
    );

    const result = await handleProxy({
      provider: 'deepseek',
      authHeader: 'Bearer sk-test',
      body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(result.record.durationMs).toBeGreaterThanOrEqual(50);
    expect(result.record.durationMs).toBeLessThan(5000);
  });
});
