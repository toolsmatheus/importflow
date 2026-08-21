@echo off
setlocal EnableExtensions
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

set "FORCE_BUILD=0"
if /I "%~1"=="/rebuild" set "FORCE_BUILD=1"
if /I "%~1"=="--rebuild" set "FORCE_BUILD=1"

set "NEED_INSTALL=0"
if not exist "backend\node_modules\" set "NEED_INSTALL=1"
if not exist "frontend\node_modules\" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo Instalando dependencias...
  call npm run install:all
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
  echo.
)

set "NEED_BUILD=%FORCE_BUILD%"
if not exist "backend\dist\server.js" set "NEED_BUILD=1"
if not exist "frontend\dist\index.html" set "NEED_BUILD=1"

if "%NEED_BUILD%"=="1" (
  echo Gerando build de producao...
  call npm run build
  if errorlevel 1 (
    echo Falha no build.
    pause
    exit /b 1
  )
  echo.
) else (
  echo Build ja existe. Para forcar: start.bat /rebuild
  echo.
)

set PORT=3001
echo Iniciando ImportFlow em http://localhost:%PORT%
echo Feche esta janela para encerrar.
echo.

REM Abre o navegador um pouco depois, dando tempo do servidor subir
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"

call npm run start --prefix backend
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo O servidor encerrou com erro %EXITCODE%.
)
pause
exit /b %EXITCODE%
