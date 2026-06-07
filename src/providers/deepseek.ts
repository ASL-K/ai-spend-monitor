// src/providers/deepseek.ts
// DeepSeek Provider
// 官方文档: https://api-docs.deepseek.com/
// base_url: https://api.deepseek.com/v1
// 模型: deepseek-chat / deepseek-reasoner
// 价格（2026-06）:
//   - deepseek-chat: 2 元 / 1M input (cache miss), 3 元 / 1M output
//   - deepseek-reasoner: 同 chat（按 token 计）

import { BaseProvider } from './base.js';

export class DeepSeekProvider extends BaseProvider {
  readonly name = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly baseUrl = 'https://api.deepseek.com/v1';

  /** DeepSeek 模型名直接透传（没有别名） */
  normalizeModel(model: string): string {
    return model;
  }
}
