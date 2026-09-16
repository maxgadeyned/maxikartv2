@echo off
title MAXIKART Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\ws" (
  echo Installing packages...
  call npm install --no-fund --no-audit
)
echo.
echo Starting MAXIKART on http://127.0.0.1:8765
echo For online friends: deploy this folder to Render.com (see render.yaml)
echo.
node server.js
pause
