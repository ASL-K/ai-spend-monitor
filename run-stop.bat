@echo off
REM ====================================================================
REM ai-spend-monitor - Stop background server
REM ====================================================================

echo.
echo ============================================================
echo  ai-spend-monitor - Stop server
echo ============================================================
echo.

REM Find node.exe processes that are running bin/ai-spend-monitor.js
REM wmic is deprecated in newer Windows; use tasklist /FI instead
echo Looking for ai-spend-monitor server process...

set FOUND=0
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq node.exe" /NH 2^>nul ^| findstr /I "node.exe"') do (
  REM %%P is the PID; we cannot easily verify it's our process without wmic
  REM Just kill all node.exe (user likely only runs dev stuff)
  echo   Found node.exe PID %%P
  set FOUND=1
)

if "%FOUND%"=="0" (
  echo   No node.exe running. Server already stopped.
  echo.
  pause
  exit /b 0
)

echo.
echo WARNING: This will kill ALL node.exe processes on this machine.
echo If you have other Node apps running, close them first or use Task Manager.
echo.
set /p CONFIRM=Type "yes" to confirm:
if not "%CONFIRM%"=="yes" (
  echo Cancelled.
  pause
  exit /b 0
)

echo Killing node.exe processes...
taskkill /F /IM node.exe 2>nul
if errorlevel 1 (
  echo   No node.exe to kill (already stopped?)
) else (
  echo   OK server stopped.
)

REM Clean up log files (optional)
if exist server.log del server.log
if exist server.err del server.err
echo   Cleaned server.log / server.err

echo.
pause
exit /b 0
