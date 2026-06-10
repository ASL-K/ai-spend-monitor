# Changelog

所有版本变更记录在此。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Planned (v0.2)
- Provider 扩展：OpenAI / Anthropic / Gemini / 智谱 GLM / 月之暗面 Kimi / Ollama 本地
- 流式响应支持（SSE 转发 + token 累计）
- 按 skillHint 拆账（"哪些 prompt 烧最多"）
- 月度预算告警（达到 80% / 100% 阈值提醒）
- 多用户/多 API key 轮询

## [0.1.0] - 2026-06-07

### Added
- **HTTP server 主入口**（`src/index.ts`）：统一服务 = 静态文件 + API + 反向代理
- **反向代理**：OpenAI 兼容 `POST /v1/chat/completions` → 转发到 provider，记一条到 SQLite
- **Provider 自动推断**：`x-provider` header 优先，否则从 model 前缀（`deepseek-*` / `minimax-*`）
- **Web UI 单页仪表盘**：本月已花 / 按 provider 拆 / 最近 30 天 / Top 10 模型
- **CLI 子命令**：`aism status` / `aism today` / `aism log`（commander 12）
- **统计 API**：`/api/health` / `/api/stats/month` / `/api/stats/daily` / `/api/stats/recent`
- **SQLite 计量表**：每次调用写一条 record（provider / model / tokens / costCNY / status）
- **CNY 算账**：硬编码美元汇率 + 2 个 provider 的 token 单价（`pricing/table.json`）

### Changed
- 全链路版本号统一为 v0.1.0（package.json / bin / src / html / run.bat）
- v0.1.1: 升 better-sqlite3 11→12（解决 Windows 11 ERR_DLOPEN_FAILED）+ 加 .env.example 模板 + README 安全章节

### Verified
- 94/94 vitest 测试通过
- tsc 0 错误
- WSL 真实跑：`POST /v1/chat/completions` → 真 DeepSeek API 401 → SQLite 自动写 error record

## [0.0.4] - 2026-06-07

### Added
- **Web UI 完整实现**（`src/web/public/index.html` + `app.js` + `style.css`）：单页 vanilla JS 仪表盘（**无依赖** — 不用 ECharts/Chart.js，纯 HTML5 + CSS 进度条）
- **CLI 子命令**（`src/cli/index.ts` + `status.ts` / `today.ts` / `log.ts`）：commander 12 + 4 子命令

### Changed
- `src/types.ts`：CLI 输出类型定义（CallRecord / MonthlyStats / DailyStats / RecentCall）

### Verified
- 79/79 vitest 测试通过
- tsc 0 错误

## [0.0.3] - 2026-06-07

### Added
- **Tracker 层**（`src/tracker/`）：SQLite insert / query / schema
  - `db.ts`：better-sqlite3 封装（openDb / closeDb / 单例）
  - `insert.ts`：写一条 call record
  - `query.ts`：月度 / 每日 / 最近 统计
  - `schema.sql`：call_records 表（8 个字段）
- **Pricing 层**（`src/pricing/`）：CNY 算账
  - `table.json`：2 个 provider 的 token 单价（DeepSeek / MiniMax）
  - `calculator.ts`：calculateCostCNY(provider, model, promptTokens, completionTokens)
- **Utils 补全**（`src/utils/format.ts`）：currentMonth / formatCNY / formatNumber
- **Error 类型**（`src/utils/errors.ts`）：ProxyError / UpstreamError / ConfigError

### Verified
- 65/65 vitest 测试通过
- tsc 0 错误

## [0.0.2] - 2026-06-07

### Added
- **Provider 抽象**（`src/providers/`）：2 个 provider
  - `base.ts`：抽象基类（ProviderConfig / 转发接口）
  - `deepseek.ts`：DeepSeek provider 实现
  - `minimax.ts`：MiniMax provider 实现
  - `registry.ts`：provider 注册表（按名字取）
- **Proxy 层**（`src/proxy/handler.ts`）：非流式转发 + 错误捕获
- **Config 加载**（`src/config.ts`）：环境变量 + 默认值
  - AISM_PORT / AISM_HOST / AISM_DB_PATH / AISM_BUDGET_CNY / AISM_LOG_LEVEL

### Verified
- 42/42 vitest 测试通过
- tsc 0 错误

## [0.0.1] - 2026-06-07

### Added
- **Type 层**（`src/types.ts`）：CallRecord / ProviderConfig / Config 核心类型
- **Utils**（`src/utils/`）：logger / format / errors 基础
- **Bin entries**（`bin/ai-spend-monitor.js` + `bin/aism.js`）：CLI 入口占位

### Verified
- 18/18 vitest 测试通过
- tsc 0 错误

## [0.0.0] - 2026-06-07

### Added
- Initial scaffold
  - package.json (Node 20+, MIT, type=module)
  - tsconfig.json (strict mode, ES2022)
  - vitest.config.ts
  - .gitignore / .npmrc / .nvmrc / .prettierrc.json / .editorconfig / .gitattributes / .eslintrc.json
  - LICENSE (MIT, Copyright 2026 ASL-K)
  - README.md / CHANGELOG.md / CODE_OF_CONDUCT.md
