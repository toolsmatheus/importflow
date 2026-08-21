@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   ImportFlow
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js 20+ e tente novamente.
  pause
  exit /b 1
)

if not exist "backend\node_modules\" (
  echo Instalando dependencias do backend...
  call npm install --prefix backend --omit=dev
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

if not exist "backend\dist\server.js" (
  echo Build do backend nao encontrado.
  if exist "backend\node_modules\typescript\" (
    echo Compilando backend...
    call npm run build --prefix backend
  ) else (
    echo Execute "npm run build" nesta pasta antes de levar ao cliente.
    pause
    exit /b 1
  )
)

if not exist "frontend\dist\index.html" (
  echo AVISO: frontend\dist nao encontrado.
  echo A API sobe, mas a interface web pode nao abrir neste processo.
  echo Rode "npm run build" antes de distribuir ao cliente.
  echo.
)

set PORT=3001
echo Iniciando ImportFlow em http://localhost:%PORT%
echo Feche esta janela para encerrar.
echo.

start "" "http://localhost:%PORT%"
call npm run start --prefix backend

pause
