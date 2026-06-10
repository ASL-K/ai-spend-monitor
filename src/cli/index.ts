// src/cli/index.ts
// CLI 入口: 用 commander 解析 aism status / today / log
//
// 注意: aism start 不在这个文件里（它要起 HTTP server，跟 aism 是两个进程）

import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from '../config.js';
import { openDb, closeDb } from '../tracker/db.js';
import { logger } from '../utils/logger.js';
import { statusCommand } from './status.js';
import { todayCommand } from './today.js';
import { logCommand } from './log.js';

export async function run(argv: string[]): Promise<void> {
  // commander 12 特殊处理: 在子命令模式下, --version/--help 触发 help 输出
  // 业务上我们要 --version 真的输出 "0.1.0", 所以手动拦截
  if (argv.includes('--version') || argv.includes('-V')) {
    console.log('0.1.0');
    return;
  }
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    printHelp();
    return;
  }

  const program = new Command();

  program
    .name('aism')
    .description('ai-spend-monitor CLI: query token spend from local SQLite')
    .version('0.1.0')
    // 关键: 让 commander 解析失败时**抛 CommanderError** 而不是 process.exit
    // 这样我们可以 catch 并正常处理；不这样会直接 kill 进程
    .exitOverride()
    .configureOutput({
      writeOut: (str) => process.stdout.write(str),
      writeErr: (str) => process.stderr.write(str),
    });

  program
    .command('status')
    .description('本月 AI 成本总览')
    .option('--db <path>', 'SQLite db path')
    .action(async (opts) => {
      const config = loadConfig(opts.db ? { dbPath: resolve(opts.db) } : {});
      logger.configure(config);
      const db = openDb(config.dbPath);
      try {
        await statusCommand(db, config);
      } finally {
        closeDb(db);
      }
    });

  program
    .command('today')
    .description('今日 AI 成本')
    .option('--db <path>', 'SQLite db path')
    .action(async (opts) => {
      const config = loadConfig(opts.db ? { dbPath: resolve(opts.db) } : {});
      logger.configure(config);
      const db = openDb(config.dbPath);
      try {
        await todayCommand(db, config);
      } finally {
        closeDb(db);
      }
    });

  program
    .command('log')
    .description('最近 N 条调用记录')
    .option('-n, --limit <n>', '显示条数', '20')
    .option('--db <path>', 'SQLite db path')
    .action(async (opts) => {
      const config = loadConfig(opts.db ? { dbPath: resolve(opts.db) } : {});
      logger.configure(config);
      const db = openDb(config.dbPath);
      try {
        await logCommand(db, config, parseInt(opts.limit, 10));
      } finally {
        closeDb(db);
      }
    });

  // exitOverride 后: --version/--help 抛 CommanderError (code 'commander.version')
  //                              解析错误抛 CommanderError (code 'commander.helpDisplayed' 等)
  // 普通子命令: parseAsync 在 action() 完后 resolve
  // 关键: 用 { from: 'user' } 因为 argv 是 process.argv.slice(2) —— 已经是 user 模式
  // 不指定 from: 'user' 时 commander 12 会把 'status' 当作未知根 option 触发 help
  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    const e = err as { code?: string };
    // commander 内部抛的"成功"型错误 (--version/--help 触发) 不算真错
    if (e.code?.startsWith('commander.')) {
      // help/version 已经输出过了，安静退出
      return;
    }
    throw err;
  }
  // action 已执行完 (同步 console.log 已 flush), 主动 exit 防 hang
  process.exit(0);
}

function printHelp(): void {
  console.log(`aism - ai-spend-monitor CLI

Usage: aism <command> [options]

Commands:
  status                本月 AI 成本总览
  today                 今日 AI 成本
  log [-n <limit>]      最近 N 条调用记录（默认 20）

Options:
  -V, --version         output the version number
  -h, --help            display help

Environment:
  AISM_DB_PATH          SQLite database path (default: ./data/ai-spend.db)
  AISM_BUDGET_CNY       Monthly budget in CNY (default: 49)
  AISM_LOG_LEVEL        debug / info / warn / error / silent
`);
}
