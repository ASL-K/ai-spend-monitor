-- src/tracker/schema.sql
-- SQLite 表结构
--
-- 1 个表: call_records（每次 API 调用一条）
-- v0.1 不做 skill 表（skillHint 字段直接存在 call_records 里）
-- v0.2 加告警表（v0.1 不做）
-- v0.3 加 cache 表（v0.1 不做）

CREATE TABLE IF NOT EXISTS call_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,                -- Unix ms
  provider TEXT NOT NULL,                    -- 'deepseek' / 'minimax'
  model TEXT NOT NULL,                       -- 用户请求的模型
  upstream_model TEXT NOT NULL,              -- 实际转发到上游的模型（一般 = model）
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cny REAL NOT NULL DEFAULT 0,          -- 折算成人民币
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('success', 'error')),
  error_message TEXT,
  skill_hint TEXT                            -- 可选：调用来源（v0.2 接入）
);

-- 索引（按月查询 + 按 provider 拆是热点）
CREATE INDEX IF NOT EXISTS idx_call_records_timestamp ON call_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_call_records_provider ON call_records(provider);
CREATE INDEX IF NOT EXISTS idx_call_records_provider_model ON call_records(provider, model);
