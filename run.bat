@echo off
REM ====================================================================
REM ai-spend-monitor - Windows launcher (v2 - matches local-llm-doctor style)
REM Avoids: for /f parsing, %i in strings, Chinese output, if/else blocks
REM ====================================================================

echo.
echo ============================================================
echo  ai-spend-monitor v0.1.0 - Windows launcher
echo ============================================================
echo.

REM 1. Check Node.js
echo [1/6] Checking Node.js...
where node 1>nul 2>nul
if errorlevel 1 goto :no_node
echo   OK Node.js found

REM 2. Check npm
echo [2/6] Checking npm...
where npm 1>nul 2>nul
if errorlevel 1 goto :no_npm
echo   OK npm found

REM 3. Check node_modules
echo [3/6] Checking dependencies...
if not exist "node_modules\" goto :need_install
echo   OK dependencies installed
goto :deps_ok

:need_install
echo   ! Installing dependencies (may take 1-2 minutes)...
echo.
call npm install
if errorlevel 1 goto :install_fail
echo.
echo   OK dependencies installed

:deps_ok

REM 4. Build TypeScript
echo [4/6] Building TypeScript...
call npm run build
if errorlevel 1 goto :build_fail
echo   OK build complete

REM 5. Start server (background via START /B)
echo [5/6] Starting ai-spend-monitor (background)...
echo.
echo ============================================================
echo   Dashboard: http://localhost:8123
echo   Proxy:     http://localhost:8123/v1/chat/completions
echo   Logs:      server.log / server.err
echo   Stop:      run-stop.bat
echo ============================================================
echo.

REM Use START /B to run in background so we can do health check
REM Output piped to logs so cmd window stays clean
start /B "" node bin\ai-spend-monitor.js 1>server.log 2>server.err

REM Wait for server to bind
echo Waiting for server to start...

REM 6. Health check (poll up to 10 seconds)
echo [6/6] Health check...
set RETRY=0
:health_loop
if %RETRY% GEQ 10 goto :health_fail
set /a RETRY+=1
REM Use curl to hit /api/health (curl is built into Windows 10+)
curl -s -o nul -w "" http://127.0.0.1:8123/api/health 2>nul
if errorlevel 1 (
  REM curl returns non-zero on connection refused, retry
  timeout /t 1 /nobreak >nul
  goto :health_loop
)
REM Health check passed
echo   OK server healthy
echo.
echo ============================================================
echo   All 6 steps passed!
echo   Open browser: http://localhost:8123
echo.
echo   Server is running in background.
echo   To stop: run-stop.bat  (or close all node.exe in Task Manager)
echo ============================================================
echo.
pause
exit /b 0

:health_fail
echo   ERROR: server did not respond within 10 seconds
echo   --- server.log ---
type server.log 2>nul
echo   --- server.err ---
type server.err 2>nul
echo.
echo   Server may have failed to bind (port 8123 in use?)
pause
exit /b 1

:no_node
echo   ERROR: Node.js not installed
echo   Please install from https://nodejs.org/ (LTS version, 20+)
pause
exit /b 1

:no_npm
echo   ERROR: npm not found (should be installed with Node.js)
pause
exit /b 1

:install_fail
echo   ERROR: npm install failed
echo   Try: npm config set registry https://registry.npmmirror.com
pause
exit /b 1

:build_fail
echo   ERROR: build failed (see error above)
echo   Try: npm run build manually to see full error
pause
exit /b 1
