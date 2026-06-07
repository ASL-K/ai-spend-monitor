#!/usr/bin/env node
// bin/ai-spend-monitor.js
// 真实入口（主服务：反向代理 + Web UI + API）
// 跟 local-llm-doctor 同套 Windows ESM 路径处理（pathToFileURL）

import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析 CLI 参数（极简，复杂用 commander 在 aism.js）
const args = process.argv.slice(2);
const overrides = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--port' || arg === '-p') {
    overrides.port = parseInt(args[++i], 10);
  } else if (arg === '--host') {
    overrides.host = args[++i];
  } else if (arg === '--db') {
    overrides.dbPath = args[++i];
  } else if (arg === '--budget') {
    overrides.budgetCNY = parseFloat(args[++i]);
  } else if (arg === '--debug') {
    overrides.logLevel = 'debug';
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (arg === '--version' || arg === '-v') {
    printVersion();
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${arg}`);
    printHelp();
    process.exit(1);
  }
}

// 加载 dist/index.js（用 pathToFileURL 处理 Windows c:\ 路径）
const distPath = resolve(__dirname, '..', 'dist', 'index.js');
if (!existsSync(distPath)) {
  console.error(`Build not found: ${distPath}`);
  console.error('Run "npm run build" first.');
  process.exit(1);
}

// 提前确保 data 目录存在（dist/index.js 启动时需要）
const dataDir = resolve(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const { main } = await import(pathToFileURL(distPath).href);
await main(overrides);

function printHelp() {
  console.log(`ai-spend-monitor v0.0.0

Usage: ai-spend-monitor [options]

Options:
  -p, --port <port>      HTTP port (default: 8123)
      --host <host>      Host to bind (default: 127.0.0.1)
      --db <path>        SQLite db path (default: ./data/ai-spend.db)
      --budget <cny>     Monthly budget in CNY (default: 49)
      --debug            Enable debug logging
  -h, --help             Show this help
  -v, --version          Show version

Environment variables (override defaults):
  AISM_PORT, AISM_HOST, AISM_DB_PATH, AISM_BUDGET_CNY, AISM_LOG_LEVEL

Dashboard:  http://localhost:<port>
Proxy:      http://localhost:<port>/v1/chat/completions
`);
}

function printVersion() {
  // 跟 package.json 同步（硬编码 v0.0.0，跟 src 一起升）
  console.log('0.0.0');
}
