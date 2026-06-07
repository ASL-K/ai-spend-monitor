#!/usr/bin/env node
// bin/aism.js
// CLI 入口（status/today/log）

import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = resolve(__dirname, '..', 'dist', 'cli', 'index.js');

try {
  const { run } = await import(pathToFileURL(distPath).href);
  await run(process.argv.slice(2));
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    console.error(`Build not found: ${distPath}`);
    console.error('Run "npm run build" first.');
    process.exit(1);
  }
  throw err;
}
