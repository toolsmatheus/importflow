@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Bootstrap minimo (~2 KB): baixa o ImportFlow do GitHub e executa start.bat.
REM Ideal para enviar so este arquivo via chat do AnyDesk (cliente precisa de internet).

echo ========================================
echo   ImportFlow - instalacao automatica
echo ========================================
echo.

set "REPO_ZIP=https://github.com/toolsmatheus/importflow/archive/refs/heads/main.zip"
set "TARGET=%~dp0ImportFlow"

if exist "%TARGET%\start.bat" (
  echo Pasta ImportFlow ja existe. Iniciando...
  echo.
  call "%TARGET%\start.bat"
  exit /b %ERRORLEVEL%
)

echo Baixando projeto do GitHub...
echo %REPO_ZIP%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; " ^
  "$zip=Join-Path $env:TEMP 'importflow-main.zip'; " ^
  "$dest=Join-Path '%~dp0.' 'ImportFlow'; " ^
  "$stage=Join-Path $env:TEMP 'importflow-extract'; " ^
  "Write-Host 'Download...'; " ^
  "Invoke-WebRequest -Uri '%REPO_ZIP%' -OutFile $zip -UseBasicParsing; " ^
  "if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }; " ^
  "New-Item -ItemType Directory -Path $stage -Force | Out-Null; " ^
  "Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force; " ^
  "$inner=Get-ChildItem $stage -Directory | Select-Object -First 1; " ^
  "if (-not $inner) { throw 'Zip invalido' }; " ^
  "if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }; " ^
  "Move-Item $inner.FullName $dest; " ^
  "Remove-Item $zip -Force -EA SilentlyContinue; " ^
  "Remove-Item $stage -Recurse -Force -EA SilentlyContinue; " ^
  "Write-Host ('Extraido em: ' + $dest)"

if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao baixar/extrair. Verifique a internet.
  echo Ou peca o arquivo ImportFlow-cliente.zip e descompacte manualmente.
  pause
  exit /b 1
)

if not exist "%TARGET%\start.bat" (
  echo [ERRO] start.bat nao encontrado apos o download.
  pause
  exit /b 1
)

echo.
echo Download ok. Iniciando ImportFlow...
echo.
call "%TARGET%\start.bat"
exit /b %ERRORLEVEL%
