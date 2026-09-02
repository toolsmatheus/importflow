@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   ImportFlow
echo ========================================
echo.

call :CheckEnvironment
if errorlevel 1 exit /b 1

set "PORT=3001"
set "FORCE_BUILD=0"
if /I "%~1"=="/rebuild" set "FORCE_BUILD=1"
if /I "%~1"=="--rebuild" set "FORCE_BUILD=1"

call :CheckPort %PORT%
if errorlevel 1 exit /b 1

set "NEED_INSTALL=0"
if not exist "backend\node_modules\" set "NEED_INSTALL=1"
if not exist "frontend\node_modules\" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo Instalando dependencias ^(primeira execucao pode demorar^)...
  call npm install --prefix backend
  if errorlevel 1 goto :FailInstall
  call npm install --prefix frontend
  if errorlevel 1 goto :FailInstall
  echo.
  echo Dependencias instaladas.
  echo.
)

set "NEED_BUILD=%FORCE_BUILD%"
if not exist "backend\dist\server.js" set "NEED_BUILD=1"
if not exist "frontend\dist\index.html" set "NEED_BUILD=1"

if "%NEED_BUILD%"=="1" (
  echo Gerando build de producao...
  call npm run build --prefix frontend
  if errorlevel 1 goto :FailBuild
  call npm run build --prefix backend
  if errorlevel 1 goto :FailBuild
  echo.
  echo Build concluido.
  echo.
) else (
  echo Build ja existe. Para forcar: start.bat /rebuild
  echo.
)

if not exist "frontend\dist\index.html" (
  echo [ERRO] frontend\dist\index.html nao encontrado apos o build.
  goto :FailBuild
)
if not exist "backend\dist\server.js" (
  echo [ERRO] backend\dist\server.js nao encontrado apos o build.
  goto :FailBuild
)

echo Iniciando ImportFlow em http://localhost:%PORT%
echo Feche esta janela para encerrar o servidor.
echo.

REM Abre o navegador quando /api/health responder (nao depende de timeout fixo)
start "" /B powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\client-wait-open.ps1" -Port %PORT%

call npm run start --prefix backend
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo O servidor encerrou com erro %EXITCODE%.
)
pause
exit /b %EXITCODE%

:CheckEnvironment
where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  echo.
  echo Instale Node.js 20 LTS: https://nodejs.org/
  echo No instalador, marque "Add to PATH".
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado no PATH.
  echo Reinstale o Node.js ^(npm vem junto^): https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node -e "const m=+process.versions.node.split('.')[0]; if(m<20){process.exit(1)}" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js 20 ou superior e necessario.
  for /f "delims=" %%v in ('node -v 2^>nul') do echo Versao atual: %%v
  echo Baixe em: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
for /f "delims=" %%v in ('npm -v 2^>nul') do set "NPM_VER=%%v"
echo Ambiente OK: Node %NODE_VER% ^| npm %NPM_VER%
echo.
exit /b 0

:CheckPort
netstat -ano | findstr /C:":%1 " | findstr LISTENING >nul 2>&1
if errorlevel 1 exit /b 0

echo [AVISO] A porta %1 ja esta em uso.
echo         Pode ser outra instancia do ImportFlow ou outro programa.
echo.
set /p "CONTINUE=Deseja tentar iniciar mesmo assim? (S/N): "
if /I not "%CONTINUE%"=="S" (
  echo Cancelado.
  pause
  exit /b 1
)
exit /b 0

:FailInstall
echo.
echo [ERRO] Falha ao instalar dependencias.
echo Verifique conexao com a internet e permissoes da pasta.
pause
exit /b 1

:FailBuild
echo.
echo [ERRO] Falha no build.
echo Tente novamente com: start.bat /rebuild
pause
exit /b 1
