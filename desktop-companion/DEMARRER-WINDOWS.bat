@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 22 est requis. Installer depuis https://nodejs.org/ puis relancer.
  pause
  exit /b 1
)
if not exist "node_modules\electron" (
  echo Installation des dependances Electron...
  call npm install --no-audit --no-fund
  if errorlevel 1 (pause & exit /b 1)
)
call npm start
if errorlevel 1 pause
