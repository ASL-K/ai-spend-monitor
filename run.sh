#!/usr/bin/env bash
# run.sh - WSL/Linux 启动脚本
# 跟 run.bat 5 步对应

set -e
STEPS=5
STEP=0

echo
echo "============================================"
echo "  ai-spend-monitor v0.0.0 Linux Launcher"
echo "============================================"
echo

# [1/5] Node.js
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "  [X] Node.js not found. Install Node.js 20+"
  exit 1
fi
echo "  [OK] Node.js $(node --version)"

# [2/5] npm
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Checking npm..."
if ! command -v npm &> /dev/null; then
  echo "  [X] npm not found"
  exit 1
fi
echo "  [OK] npm $(npm --version)"

# [3/5] 依赖
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies (1-2 minutes)..."
  npm install
else
  echo "  [OK] dependencies already installed"
fi

# [4/5] 编译
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Building TypeScript..."
node node_modules/typescript/bin/tsc
npm run copy-assets
echo "  [OK] build complete"

# [5/5] 启动
STEP=$((STEP+1))
echo "[$STEP/$STEPS] Starting ai-spend-monitor..."
echo
echo "Dashboard: http://localhost:8123"
echo "Proxy:     http://localhost:8123/v1/chat/completions"
echo
echo "Press Ctrl+C to stop"
echo
exec node bin/ai-spend-monitor.js
