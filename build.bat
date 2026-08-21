@echo off
setlocal
cd /d "%~dp0"

echo Instalando dependencias e gerando build de producao...
call npm run install:all
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1

echo.
echo Build concluido. No cliente, use start.bat
pause
