@echo off
setlocal

REM ai-spend-monitor Windows launcher (ASCII only to avoid GBK/UTF-8 issues)

set STEPS=5
set STEP=0

echo.
echo ============================================
echo   ai-spend-monitor v0.0.0 Windows Launcher
echo ============================================
echo.

REM [1/5] Node.js check
set /a STEP+=1
echo [%STEP%/%STEPS%] Checking Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js not found
  echo   Please install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v

REM [2/5] npm check
set /a STEP+=1
echo [%STEP%/%STEPS%] Checking npm
where npm >nul 2>nul
if errorlevel 1 (
  echo   [X] npm not found
  pause
  exit /b 1
)
for /f "delims=" %%v in ('npm --version') do echo   [OK] npm %%v

REM [3/5] dependencies
set /a STEP+=1
echo [%STEP%/%STEPS%] Checking dependencies
if not exist node_modules (
  echo   Installing dependencies (this may take 1-2 minutes)
  call npm install
  if errorlevel 1 (
    echo   [X] npm install failed
    pause
    exit /b 1
  )
) else (
  echo   [OK] dependencies already installed
)

REM [4/5] build
set /a STEP+=1
echo [%STEP%/%STEPS%] Building TypeScript
call node node_modules/typescript/bin/tsc
if errorlevel 1 (
  echo   [X] TypeScript build failed
  pause
  exit /b 1
)
call npm run copy-assets
if errorlevel 1 (
  echo   [X] copy-assets failed
  pause
  exit /b 1
)
echo   [OK] build complete

REM [5/5] start
set /a STEP+=1
echo [%STEP%/%STEPS%] Starting ai-spend-monitor
echo.
echo Dashboard: http://localhost:8123
echo Proxy:     http://localhost:8123/v1/chat/completions
echo.
echo Press Ctrl+C to stop
echo.
call node bin/ai-spend-monitor.js
if errorlevel 1 (
  echo.
  echo [X] Server exited with error
  pause
  exit /b 1
)

endlocal
