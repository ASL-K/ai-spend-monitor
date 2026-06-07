// src/config.ts
// 配置加载（v0.1：从环境变量 + 默认值，不引 dotenv 避免多一个依赖）

import { ConfigError, type Config } from './types.js';

const DEFAULTS: Config = {
  port: 8123,
  host: '127.0.0.1',
  dbPath: './data/ai-spend.db',
  budgetCNY: 49.0,
  logLevel: 'info',
};

export function loadConfig(overrides: Partial<Config> = {}): Config {
  // 优先级: overrides > env > DEFAULTS
  const config: Config = {
    port: overrides.port ?? parsePort(process.env.AISM_PORT) ?? DEFAULTS.port,
    host: overrides.host ?? process.env.AISM_HOST ?? DEFAULTS.host,
    dbPath: overrides.dbPath ?? process.env.AISM_DB_PATH ?? DEFAULTS.dbPath,
    budgetCNY:
      overrides.budgetCNY ??
      (process.env.AISM_BUDGET_CNY
        ? Number.isFinite(parseFloat(process.env.AISM_BUDGET_CNY))
          ? parseFloat(process.env.AISM_BUDGET_CNY)
          : null
        : null) ??
      DEFAULTS.budgetCNY,
    logLevel:
      overrides.logLevel ?? parseLogLevel(process.env.AISM_LOG_LEVEL) ?? DEFAULTS.logLevel,
  };
  return config;
}

function parsePort(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 1 || n > 65535) {
    throw new ConfigError(`Invalid port: ${v}`);
  }
  return n;
}

function parseLogLevel(v: string | undefined): Config['logLevel'] | null {
  if (!v) return null;
  if (['debug', 'info', 'warn', 'error', 'silent'].includes(v)) {
    return v as Config['logLevel'];
  }
  throw new ConfigError(`Invalid log level: ${v}`);
}
