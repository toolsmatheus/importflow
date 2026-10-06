@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ToolsDataWeb

set "NODE_MAJOR_MIN=20"
set "PORT=3001"
set "URL=http://localhost:%PORT%"
set "FORCE_REBUILD=0"
if /I "%~1"=="/rebuild" set "FORCE_REBUILD=1"
if /I "%~1"=="--rebuild" set "FORCE_REBUILD=1"

echo.
echo  ToolsDataWeb
echo  ----------

call :ensure_node
if errorlevel 1 exit /b 1

set "NEED_INSTALL=0"
if not exist "node_modules\" set "NEED_INSTALL=1"
if not exist "package-lock.json" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo [1/3] Instalando dependencias (npm workspaces^)...
  call npm install
  if errorlevel 1 (
    echo ERRO: npm install falhou. Verifique a internet e tente de novo.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependencias OK
)

set "NEED_BUILD=0"
if "%FORCE_REBUILD%"=="1" set "NEED_BUILD=1"
if not exist "frontend\dist\index.html" set "NEED_BUILD=1"
if not exist "backend\dist\server.js" set "NEED_BUILD=1"

if "%NEED_BUILD%"=="0" (
  call :source_newer_than_build
  if errorlevel 1 set "NEED_BUILD=1"
)

if "%NEED_BUILD%"=="1" (
  echo [2/3] Gerando build...
  call npm run build
  if errorlevel 1 (
    echo ERRO: build falhou.
    pause
    exit /b 1
  )
) else (
  echo [2/3] Build OK
)

echo [3/3] Iniciando em %URL%
echo      (feche esta janela para encerrar)
echo.

start "" /b cmd /c "timeout /t 2 /nobreak >nul & powershell -NoProfile -Command \"try { for($i=0;$i -lt 45;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing '%URL%/api/health' -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process '%URL%'; break } } catch {} Start-Sleep -Seconds 1 } } catch {}\""

call npm start
echo.
echo Servidor encerrado.
pause
exit /b 0

:ensure_node
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Baixando runtime portatil...
  call :install_portable_node
  exit /b %errorlevel%
)

for /f "tokens=1 delims=v." %%A in ('node -v 2^>nul') do set "NODE_MAJOR=%%A"
if not defined NODE_MAJOR (
  echo Nao foi possivel ler a versao do Node. Baixando runtime portatil...
  call :install_portable_node
  exit /b %errorlevel%
)

if %NODE_MAJOR% LSS %NODE_MAJOR_MIN% (
  echo Node v%NODE_MAJOR% detectado; ToolsDataWeb precisa de Node %NODE_MAJOR_MIN%+.
  echo Baixando runtime portatil...
  call :install_portable_node
  exit /b %errorlevel%
)

exit /b 0

:install_portable_node
set "RUNTIME_DIR=%~dp0.runtime\node"
set "NODE_EXE=%RUNTIME_DIR%\node.exe"
if exist "%NODE_EXE%" (
  for /f "tokens=1 delims=v." %%A in ('"%NODE_EXE%" -v 2^>nul') do set "PORTABLE_MAJOR=%%A"
  if defined PORTABLE_MAJOR if %PORTABLE_MAJOR% GEQ %NODE_MAJOR_MIN% (
    set "PATH=%RUNTIME_DIR%;%PATH%"
    echo Usando Node portatil em .runtime\node
    exit /b 0
  )
)

set "TMP_ZIP=%TEMP%\toolsdataweb-node.zip"
set "TMP_EXTRACT=%TEMP%\toolsdataweb-node-extract"
set "NODE_DIST_URL=https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip"

echo Baixando Node 20 LTS (pode levar 1–2 min^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -Uri '%NODE_DIST_URL%' -OutFile '%TMP_ZIP%';" ^
  "if (Test-Path '%TMP_EXTRACT%') { Remove-Item -Recurse -Force '%TMP_EXTRACT%' };" ^
  "Expand-Archive -Path '%TMP_ZIP%' -DestinationPath '%TMP_EXTRACT%' -Force;" ^
  "New-Item -ItemType Directory -Force -Path '%RUNTIME_DIR%' | Out-Null;" ^
  "Get-ChildItem '%TMP_EXTRACT%' -Directory | Select-Object -First 1 | ForEach-Object {" ^
  "  Copy-Item -Path (Join-Path $_.FullName '*') -Destination '%RUNTIME_DIR%' -Recurse -Force" ^
  "}"

if not exist "%NODE_EXE%" (
  echo ERRO: falha ao instalar Node portatil.
  echo Instale Node.js 20+ em https://nodejs.org e execute start.bat de novo.
  pause
  exit /b 1
)

set "PATH=%RUNTIME_DIR%;%PATH%"
echo Node portatil pronto.
exit /b 0

:source_newer_than_build
powershell -NoProfile -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$frontDist = Get-Item 'frontend\dist\index.html' -ErrorAction SilentlyContinue;" ^
  "$backDist = Get-Item 'backend\dist\server.js' -ErrorAction SilentlyContinue;" ^
  "if (-not $frontDist -or -not $backDist) { exit 1 };" ^
  "$cutoff = if ($frontDist.LastWriteTime -lt $backDist.LastWriteTime) { $frontDist.LastWriteTime } else { $backDist.LastWriteTime };" ^
  "$newer = Get-ChildItem -Path 'frontend\src','backend\src','frontend\index.html','frontend\vite.config.ts','backend\tsconfig.json' -Recurse -File -ErrorAction SilentlyContinue |" ^
  "  Where-Object { $_.LastWriteTime -gt $cutoff } |" ^
  "  Select-Object -First 1;" ^
  "if ($newer) { exit 1 } else { exit 0 }"
exit /b %errorlevel%
