@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title ImportFlow

echo ========================================
echo   ImportFlow
echo ========================================
echo.

REM --- Node.js: usa o do sistema se >= 20; senao baixa runtime portatil ---
call :EnsureNode
if errorlevel 1 exit /b 1

set "PORT=3001"
set "FORCE_BUILD=0"
if /I "%~1"=="/rebuild" set "FORCE_BUILD=1"
if /I "%~1"=="--rebuild" set "FORCE_BUILD=1"

REM Libera a porta (instancia anterior / processo zumbi) sem perguntar
call :FreePort %PORT%
if errorlevel 1 exit /b 1

set "NEED_INSTALL=0"
if not exist "backend\node_modules\" set "NEED_INSTALL=1"
if not exist "frontend\node_modules\" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo Instalando dependencias ^(pode demorar na primeira vez^)...
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

REM Rebuild se o source estiver mais novo que o dist (evita servir codigo antigo)
if "%NEED_BUILD%"=="0" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$be=(Get-ChildItem 'backend\src' -Recurse -Filter '*.ts' -EA SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1); " ^
    "$bd=Get-Item 'backend\dist\server.js' -EA SilentlyContinue; " ^
    "$fe=(Get-ChildItem 'frontend\src' -Recurse -Include '*.ts','*.tsx','*.css' -EA SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1); " ^
    "$fd=Get-Item 'frontend\dist\index.html' -EA SilentlyContinue; " ^
    "if (($be -and $bd -and $be.LastWriteTime -gt $bd.LastWriteTime) -or ($fe -and $fd -and $fe.LastWriteTime -gt $fd.LastWriteTime)) { exit 1 }; exit 0" >nul 2>&1
  if errorlevel 1 (
    echo Source mais novo que o dist — rebuild automatico.
    set "NEED_BUILD=1"
  )
)

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

REM Abre o navegador quando /api/health responder
start "" /B powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\client-wait-open.ps1" -Port %PORT%

set "PORT=%PORT%"
call npm run start --prefix backend
set "EXITCODE=!ERRORLEVEL!"

echo.
if not "!EXITCODE!"=="0" (
  echo O servidor encerrou com erro !EXITCODE!.
  echo Se a porta %PORT% estiver bloqueada, feche outras janelas do ImportFlow e tente de novo.
)
pause
exit /b !EXITCODE!

:EnsureNode
REM Garante Node >= 20: PATH ok, ou baixa .runtime\node (portatil, sem admin)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node.ps1" -MinMajor 20
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel preparar o Node.js automaticamente.
  echo Opcoes:
  echo   1^) Instale Node 20 LTS em https://nodejs.org/ ^(marque Add to PATH^)
  echo   2^) Verifique a internet e execute start.bat de novo
  echo.
  pause
  exit /b 1
)

if exist "%~dp0.runtime\use-node.cmd" (
  call "%~dp0.runtime\use-node.cmd"
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js ainda nao esta disponivel no PATH desta sessao.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado ^(deveria vir com o Node^).
  pause
  exit /b 1
)

node -e "const m=+process.versions.node.split('.')[0]; if(m<20){process.exit(1)}" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js ainda abaixo da versao 20 apos a preparacao.
  for /f "delims=" %%v in ('node -v 2^>nul') do echo Versao atual: %%v
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
for /f "delims=" %%v in ('npm -v 2^>nul') do set "NPM_VER=%%v"
echo Ambiente OK: Node %NODE_VER% ^| npm %NPM_VER%
echo.
exit /b 0

:FreePort
REM Encerra o processo que estiver LISTENING na porta %1 (sem prompt)
set "FREED=0"
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr /C:":%1 " ^| findstr LISTENING') do (
  if not "%%p"=="0" if not "%%p"=="" (
    echo Liberando porta %1 ^(PID %%p^)...
    taskkill /F /T /PID %%p >nul 2>&1
    set "FREED=1"
  )
)
if "!FREED!"=="1" (
  ping -n 3 127.0.0.1 >nul
)

REM Confirma que a porta ficou livre
netstat -ano 2>nul | findstr /C:":%1 " | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
  echo.
  echo [ERRO] A porta %1 continua em uso e nao foi possivel libera-la.
  echo Feche outras janelas do ImportFlow / Node e execute start.bat de novo.
  echo.
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
