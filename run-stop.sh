#!/usr/bin/env bash
# run-stop.sh - WSL/Linux/macOS 停止后台服务

set -e

echo
echo "============================================"
echo "  ai-spend-monitor - Stop server"
echo "============================================"
echo

if [ ! -f .server.pid ]; then
  echo "  No .server.pid found. Server may not be running via run.sh"
  echo "  Try: pkill -f 'bin/ai-spend-monitor'"
  echo
  exit 0
fi

PID=$(cat .server.pid)

if ! kill -0 $PID 2>/dev/null; then
  echo "  PID $PID not running. Stale .server.pid file."
  rm -f .server.pid
  echo "  Cleaned stale .server.pid"
  exit 0
fi

echo "  Found server PID: $PID"
echo "  Killing..."
kill $PID
sleep 1

if kill -0 $PID 2>/dev/null; then
  echo "  Still running, force killing..."
  kill -9 $PID
fi

rm -f .server.pid
rm -f server.log server.err
echo "  OK server stopped. Cleaned logs."
echo
