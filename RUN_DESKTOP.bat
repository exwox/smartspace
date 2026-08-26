@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js belum terinstall.
  pause
  exit /b 1
)
if not exist node_modules call npm install
if not exist frontend\node_modules call npm --prefix frontend install
if not exist backend\node_modules call npm --prefix backend install
call npm run desktop
pause
