// src/utils/errors.ts
// 自定义错误（已有 types.ts 里的 ProviderError/ConfigError/TrackerError 也可用）

/** 反向代理层错误 */
export class ProxyError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public provider?: string
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

/** 找不到 provider */
export class UnknownProviderError extends ProxyError {
  constructor(provider: string) {
    super(`Unknown provider: ${provider}`, 400, provider);
    this.name = 'UnknownProviderError';
  }
}

/** API key 缺失 */
export class MissingApiKeyError extends ProxyError {
  constructor(provider: string) {
    super(`Missing API key for provider: ${provider}`, 401, provider);
    this.name = 'MissingApiKeyError';
  }
}

/** 上游 API 返回非 2xx */
export class UpstreamError extends ProxyError {
  constructor(
    provider: string,
    public upstreamStatus: number,
    public upstreamBody: string
  ) {
    super(
      `Upstream ${provider} returned ${upstreamStatus}: ${upstreamBody.slice(0, 200)}`,
      upstreamStatus,
      provider
    );
    this.name = 'UpstreamError';
  }
}

/** SQLite 错误 */
export class DbError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'DbError';
  }
}
