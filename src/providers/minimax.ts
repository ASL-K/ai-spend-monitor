// src/providers/minimax.ts
// MiniMax Provider
// 官方文档: https://api.minimaxi.com/
// base_url: https://api.minimaxi.com/v1
// 模型: MiniMax-Text-01 / MiniMax-Reasoning / abab-6.5s-chat 等
// 价格（2026-06）:
//   - MiniMax-Text-01: 1 元 / 1M input, 1 元 / 1M output（49元套餐内部价）
//   - MiniMax-Reasoning: 4 元 / 1M input, 16 元 / 1M output

import { BaseProvider } from './base.js';

export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';
  readonly displayName = 'MiniMax';
  readonly baseUrl = 'https://api.minimaxi.com/v1';

  /** MiniMax 模型名直接透传 */
  normalizeModel(model: string): string {
    return model;
  }
}
