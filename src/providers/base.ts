// src/providers/base.ts
// Provider 抽象基类
//
// 4 个 provider 共享这个 base，差异只在：
//   - baseUrl（上游 API 地址）
//   - normalizeModel（如果 provider 有别名映射）
//   - extractUsage（不同 provider 的 usage 字段位置可能不同）

import type { Provider } from '../types.js';

export interface ProviderOptions {
  name: string;
  displayName: string;
  baseUrl: string;
}

export abstract class BaseProvider implements Provider {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;

  /** 默认实现：模型名直接透传。大部分 provider 都是这样。 */
  normalizeModel(model: string): string {
    return model;
  }

  /**
   * 从响应体提取 token usage
   * 默认实现：OpenAI 兼容格式（prompt_tokens/completion_tokens/total_tokens）
   * 如果某个 provider 的格式不同，重写这个方法
   */
  extractUsage(responseBody: unknown): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    const body = responseBody as Record<string, unknown> | null;
    const usage = body?.usage as Record<string, number> | undefined;
    if (!usage) {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }
    return {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  }

  /** 从 Authorization header 提取 API key */
  extractApiKey(authHeader: string | undefined): string {
    if (!authHeader) return '';
    // 必须有 Bearer 前缀（大小写不敏感），否则视为无效
    // 避免把别的 header 值误当 key
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? '';
  }
}
