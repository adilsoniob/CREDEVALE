@echo off
title Vale Saude - Servidor
echo ========================================
echo  Iniciando servidor Vale Saude...
echo ========================================
echo.

:: Mata processos node na porta 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
  taskkill /f /pid %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

:: Inicia o servidor
cd /d "%~dp0backend"
node server.js

pause
