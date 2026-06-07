// src/utils/logger.ts
// 5 级日志（debug/info/warn/error/silent）

import type { Config } from '../types.js';

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
} as const;

const COLORS: Record<string, string> = {
  debug: '\x1b[90m', // 灰
  info: '\x1b[36m', // 青
  warn: '\x1b[33m', // 黄
  error: '\x1b[31m', // 红
  reset: '\x1b[0m',
};

const LEVEL_PREFIX: Record<string, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

class Logger {
  private level: number = LEVELS.info;
  private useColor: boolean = true;

  configure(config: Config) {
    this.level = LEVELS[config.logLevel];
    // 简单判断：tty 时有颜色，pipe 时无
    this.useColor = process.stdout.isTTY ?? false;
  }

  setLevel(level: keyof typeof LEVELS) {
    this.level = LEVELS[level];
  }

  debug(msg: string, ...args: unknown[]) {
    this.log('debug', msg, args);
  }

  info(msg: string, ...args: unknown[]) {
    this.log('info', msg, args);
  }

  warn(msg: string, ...args: unknown[]) {
    this.log('warn', msg, args);
  }

  error(msg: string, ...args: unknown[]) {
    this.log('error', msg, args);
  }

  private log(level: keyof typeof LEVELS, msg: string, args: unknown[]) {
    if (LEVELS[level] < this.level) return;
    // silent level never reaches here (sorts last in LEVELS)
    const color = COLORS[level] ?? '';
    const prefixText = LEVEL_PREFIX[level] ?? level.toUpperCase();
    const prefix = this.useColor ? `${color}${prefixText}${COLORS.reset}` : prefixText;
    const ts = new Date().toISOString().slice(11, 23); // 'HH:mm:ss.SSS'
    const argStr = args.length > 0 ? ' ' + args.map(stringify).join(' ') : '';
    process.stdout.write(`[${ts}] ${prefix} ${msg}${argStr}\n`);
  }
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.stack ?? v.message;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const logger = new Logger();
