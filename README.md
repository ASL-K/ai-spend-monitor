# ai-spend-monitor

> 100% 本地部署的个人 AI Token 成本仪表盘 — 反向代理 + SQLite 计量 + Web 仪表盘

## 这是什么

一个跑在你本机的 HTTP 服务，**把每次 AI 调用的 token 数、金额记到本地 SQLite，并提供一个单页仪表盘**。

```
你的 client ─→ http://localhost:8123/v1/chat/completions ─→ 真 provider (DeepSeek / MiniMax / ...)
                ↓
              SQLite 写一条 (provider / model / tokens / costCNY)
                ↓
              http://localhost:8123 浏览器看仪表盘
```

**核心特性**

- **零配置启动**：装好 Node 20+ → `npm install` → `npm start` → 浏览器开 `http://localhost:8123` 就完事
- **OpenAI 兼容**：把你的 client 代码 `base_url` 改成 `http://localhost:8123/v1` 即可
- **真 provider 透传**：本地不再存 API key，直接透传你的 `Authorization: Bearer sk-xxx`
- **SQLite 计量**：每次调用写一条 (promptTokens / completionTokens / costCNY / status)
- **Web 仪表盘**：本月已花 / 按 provider 拆 / 最近 30 天 / Top 10 模型
- **CLI 查询**：`aism status` / `aism today` / `aism log` 终端里直接看
- **4 个 API**：`/api/health` / `/api/stats/month` / `/api/stats/daily` / `/api/stats/recent`
- **100% 本地**：所有数据在你本机 SQLite，零数据外发

## 安装

```bash
# 1. 装 Node.js 20+
#    https://nodejs.org/

# 2. 拉代码
git clone https://github.com/ASL-K/ai-spend-monitor.git
cd ai-spend-monitor

# 3. 装依赖
npm install

# 4. 编译
npm run build

# 5. 启动
npm start
# 或 Windows 双击 run.bat
```

**启动成功**：

```
[INFO] ai-spend-monitor v0.1.0 starting
[INFO] Listening on http://127.0.0.1:8123
[INFO] Database: /path/to/ai-spend-monitor/data/ai-spend.db
[INFO] Providers: deepseek, minimax
[INFO] Dashboard: http://127.0.0.1:8123
[INFO] Proxy:     http://127.0.0.1:8123/v1/chat/completions
[INFO] Press Ctrl+C to stop
```

## 使用

### 方法 1：浏览器看仪表盘

打开 `http://localhost:8123`

- 顶部：当前月已花 / 49 元套餐预算 / 进度条
- 按 Provider 拆：本月每个 provider 花了多少
- 最近 30 天：每日条形图
- Top 10 模型：哪个模型最烧钱

### 方法 2：把 client 指向本地

把任何支持 `base_url` 配置的 AI client（OpenAI SDK / LangChain / Cursor / Continue.dev 等）改成：

```
https://api.deepseek.com/v1   →   http://localhost:8123/v1
```

加一个 header：`x-provider: deepseek`（或 `minimax`）

OpenAI SDK Python 示例：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8123/v1",  # 原来是 https://api.deepseek.com/v1
    api_key="sk-你的真实key",              # 本地不再存, 直接透传
    default_headers={"x-provider": "deepseek"},
)

resp = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好"}],
)
```

### 方法 3：curl 测一下

```bash
# 健康检查
curl http://localhost:8123/api/health
# {"status":"ok","version":"0.1.0","providers":["deepseek","minimax"]}

# 真实代理调用
curl -X POST http://localhost:8123/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-你的真实key" \
  -H "x-provider: deepseek" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}]}'
```

### 方法 4：CLI 查询

```bash
# 本月总览
node bin/aism.js status

# 今天明细
node bin/aism.js today

# 最近 10 条
node bin/aism.js log -n 10
```

## 配置（环境变量，可选）

| 变量 | 默认 | 说明 |
|---|---|---|
| `AISM_PORT` | 8123 | HTTP 端口 |
| `AISM_HOST` | 127.0.0.1 | 绑定 host |
| `AISM_DB_PATH` | `./data/ai-spend.db` | SQLite 路径 |
| `AISM_BUDGET_CNY` | 49 | 月度预算（用于仪表盘进度条） |
| `AISM_LOG_LEVEL` | info | debug / info / warn / error |

CLI 参数覆盖：`--port 8888` / `--db /tmp/test.db` / `--budget 100` / `--debug`

## 已支持的 Provider

| Provider | 模型示例 | 备注 |
|---|---|---|
| `deepseek` | `deepseek-chat` / `deepseek-coder` / `deepseek-reasoner` | 性价比最高 |
| `minimax` | `MiniMax-Text-01` / `abab6.5s-chat` | MiniMax 全家桶 |

v0.2 计划增加：OpenAI / Anthropic / Gemini / 智谱 GLM / 月之暗面 Kimi / Ollama 本地。

## 架构

```
ai-spend-monitor/
├── src/
│   ├── index.ts              # HTTP server 主入口（静态 + API + 代理）
│   ├── config.ts             # 环境变量加载
│   ├── types.ts              # 核心类型
│   ├── providers/            # Provider 抽象（base + deepseek + minimax + registry）
│   ├── proxy/handler.ts      # 反向代理
│   ├── tracker/              # SQLite 计量（db + insert + query + schema）
│   ├── pricing/              # CNY 算账（calculator + table.json）
│   ├── cli/                  # CLI（commander 12: status / today / log）
│   ├── utils/                # logger / format / errors
│   └── web/public/           # 静态文件（index.html + app.js + style.css）
├── bin/                      # CLI 入口（ai-spend-monitor.js + aism.js）
├── tests/                    # vitest（94 个测试）
├── data/                     # SQLite 库（运行时生成）
├── run.bat                   # Windows 启动器
└── run.sh                    # Linux/macOS 启动器
```

**数据流**：

```
Client POST /v1/chat/completions
    ↓
[index.ts handleProxyRoute]
    ├─ 决定 provider（header 优先 / model 前缀推断）
    ├─ [proxy/handler.ts handleProxy] 转发到真 API
    ├─ [pricing/calculator.ts] 算 costCNY
    └─ [tracker/insert.ts insertCall] 写 SQLite

GET /api/stats/*
    ↓
[index.ts handleApi]
    └─ [tracker/query.ts] 查 SQLite 返回 JSON

GET /
    ↓
[index.ts handleStatic]
    └─ src/web/public/index.html（app.js 调 3 个 API 渲染）
```

## 开发

```bash
# 跑测试
npm test                # 94/94 通过

# 类型检查
npm run typecheck       # tsc 0 错误

# 编译
npm run build

# 启动开发服务
npm start

# 调试模式（详细日志）
npm start -- --debug
```

## License

MIT © 2026 ASL-K
