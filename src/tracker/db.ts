// src/tracker/db.ts
// SQLite 初始化（用 better-sqlite3 同步 API）
// 注意: better-sqlite3 是 native module，首次安装需要编译

import Database, { type Database as Db } from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { DbError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** 打开数据库（首次启动会自动建表 + 索引） */
export function openDb(dbPath: string): Db {
  try {
    // 确保父目录存在
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // 提升并发读写
    db.pragma('foreign_keys = ON');

    // 加载 schema.sql 并执行
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    logger.debug(`SQLite ready at ${dbPath}`);
    return db;
  } catch (err) {
    throw new DbError(`Failed to open database at ${dbPath}`, err);
  }
}

/** 关闭数据库 */
export function closeDb(db: Db): void {
  try {
    db.close();
  } catch (err) {
    logger.warn(`Error closing db: ${(err as Error).message}`);
  }
}
