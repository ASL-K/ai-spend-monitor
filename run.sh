#!/usr/bin/env bash
# run.sh - WSL/Linux/macOS 启动脚本
# 跟 run.bat 6 步对应 (Node → npm → deps → build → start → health check)
# 风格: 纯英文输出 (避免 Windows 共享时的编码问题)

set -e
STEPS=6
STEP=0

echo
echo "============================================"
echo "  ai-spend-monitor v0.1.0 Linux Launcher"
echo "============================================"
echo

# [1/6] Node.js
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "  [X] Node.js not found. Install Node.js 20+"
  exit 1
fi
echo "  OK Node.js $(node --version)"

# [2/6] npm
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Checking npm..."
if ! command -v npm &> /dev/null; then
  echo "  [X] npm not found"
  exit 1
fi
echo "  OK npm $(npm --version)"

# [3/6] 依赖
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies (1-2 minutes)..."
  npm install
else
  echo "  OK dependencies installed"
fi

# [4/6] 编译
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Building TypeScript..."
node node_modules/typescript/bin/tsc
npm run copy-assets
echo "  OK build complete"

# [5/6] 启动 (后台跑, 写日志, 留 health check 余地)
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Starting ai-spend-monitor (background)..."
echo
echo "============================================"
echo "  Dashboard: http://localhost:8123"
echo "  Proxy:     http://localhost:8123/v1/chat/completions"
echo "  Logs:      server.log / server.err"
echo "  Stop:      ./run-stop.sh"
echo "============================================"
echo

# 后台跑 + 写日志
nohup node bin/ai-spend-monitor.js > server.log 2> server.err &
SERVER_PID=$!
echo $SERVER_PID > .server.pid
echo "  Server PID: $SERVER_PID"

# [6/6] Health check (poll up to 10 seconds)
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Health check..."
RETRY=0
while [ $RETRY -lt 10 ]; do
  if curl -s -o /dev/null -w "" http://127.0.0.1:8123/api/health 2>/dev/null; then
    echo "  OK server healthy"
    echo
    echo "============================================"
    echo "  All 6 steps passed!"
    echo "  Open browser: http://localhost:8123"
    echo
    echo "  Server is running in background (PID $SERVER_PID)."
    echo "  To stop: ./run-stop.sh"
    echo "============================================"
    echo
    exit 0
  fi
  RETRY=$((RETRY+1))
  sleep 1
done

echo "  [X] server did not respond within 10 seconds"
echo "  --- server.log ---"
cat server.log 2>/dev/null || echo "(empty)"
echo "  --- server.err ---"
cat server.err 2>/dev/null || echo "(empty)"
echo
echo "  Server may have failed to bind (port 8123 in use?)"
exit 1
