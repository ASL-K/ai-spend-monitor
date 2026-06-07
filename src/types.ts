// src/types.ts
// 全部类型定义集中处（避免循环依赖）

/** 一次 API 调用的完整记录 */
export interface CallRecord {
  id?: number;
  timestamp: number; // Unix ms
  provider: string; // 'deepseek' | 'minimax' | 'openai' | 'kimi' | ...
  model: string; // 用户请求的模型
  upstreamModel: string; // 实际转发用的模型（一般等于 model）
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCNY: number; // 折算成人民币
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  skillHint?: string; // 可选：调用来源（用于"按 skill 拆"功能，v0.2 接入）
}

/** Provider 抽象 */
export interface Provider {
  readonly name: string;
  readonly displayName: string;
  readonly baseUrl: string;
  /** 把模型名归一化到上游支持的名称 */
  normalizeModel(model: string): string;
  /** 提取 token 用量从响应体 */
  extractUsage(responseBody: unknown): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 从 Authorization header 提取 API key（不变，去掉 Bearer 前缀） */
  extractApiKey(authHeader: string | undefined): string;
}

/** 价格表条目 */
export interface PriceEntry {
  provider: string;
  model: string;
  /** 每 1k input token 人民币价格 */
  inputPer1kCNY: number;
  /** 每 1k output token 人民币价格 */
  outputPer1kCNY: number;
  /** 更新时间 ISO string */
  updatedAt: string;
}

export interface PriceTable {
  version: string;
  /** 美元兑人民币汇率（硬编码在 v0.1） */
  usdToCNY: number;
  prices: PriceEntry[];
}

/** 月度统计 */
export interface MonthlyStats {
  month: string; // 'YYYY-MM'
  totalCostCNY: number;
  totalTokens: number;
  totalCalls: number;
  byProvider: ProviderStat[];
  byModel: ModelStat[];
}

export interface ProviderStat {
  provider: string;
  costCNY: number;
  totalTokens: number;
  callCount: number;
  percentage: number; // 0-100
}

export interface ModelStat {
  provider: string;
  model: string;
  costCNY: number;
  totalTokens: number;
  callCount: number;
}

/** 时间序列统计（按天） */
export interface DailyStats {
  date: string; // 'YYYY-MM-DD'
  costCNY: number;
  totalTokens: number;
  callCount: number;
}

/** CLI 配置 */
export interface Config {
  port: number;
  host: string;
  dbPath: string;
  budgetCNY: number; // 月度预算（人民币）
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

/** 错误类型 */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public statusCode?: number
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class TrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrackerError';
  }
}
