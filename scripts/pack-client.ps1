# Gera zip pronto para o cliente (AnyDesk / pen drive).
# Inclui: build (frontend/dist + backend/dist), node_modules e Node portatil em .runtime\node.
# O cliente descompacta e executa start.bat — sem instalar Node no Windows.
param(
  [string]$OutDir = "",
  [string]$ZipName = "ToolsDataWeb-cliente.zip",
  [switch]$SkipBuild,
  [switch]$SkipNodeDownload
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $projectRoot 'dist-client' }

$stageRoot = Join-Path $OutDir '_stage'
$stage = Join-Path $stageRoot 'ToolsDataWeb'
$zipPath = Join-Path $OutDir $ZipName
$nodeVersion = 'v20.18.1'
$nodeZipName = "node-$nodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/$nodeVersion/$nodeZipName"

Write-Host "Empacotando ToolsDataWeb (cliente pronto para rodar)..."
Write-Host "Origem: $projectRoot"

Push-Location $projectRoot
try {
  if (-not $SkipBuild) {
    Write-Host "[1/4] Build de producao..."
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build falhou (exit $LASTEXITCODE)" }
  } else {
    Write-Host "[1/4] Build ignorado (-SkipBuild)"
  }

  if (-not (Test-Path 'frontend\dist\index.html')) { throw 'frontend/dist/index.html ausente' }
  if (-not (Test-Path 'backend\dist\server.js')) { throw 'backend/dist/server.js ausente' }
  if (-not (Test-Path 'node_modules')) { throw 'node_modules ausente — rode npm install antes' }
}
finally {
  Pop-Location
}

if (Test-Path -LiteralPath $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$excludeDirNames = [System.Collections.Generic.HashSet[string]]::new([string[]]@(
  'dist-client', '.git', '.cursor', 'agent-transcripts', 'coverage', '.vite',
  'Downloads', 'temp', 'staging', '.runtime'
))

$excludeFileGlobs = @(
  '*.xlsx', '*.log', '.env', '.env.local', 'Thumbs.db', '.DS_Store',
  '*.map', '.gitkeep'
)

function Should-SkipDir([System.IO.DirectoryInfo]$dir) {
  return $excludeDirNames.Contains($dir.Name)
}

function Should-SkipFile([System.IO.FileInfo]$file) {
  foreach ($g in $excludeFileGlobs) {
    if ($file.Name -like $g) { return $true }
  }
  return $false
}

function Copy-Tree([string]$src, [string]$dst) {
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Get-ChildItem -LiteralPath $src -Force | ForEach-Object {
    if ($_.PSIsContainer) {
      if (Should-SkipDir $_) { return }
      Copy-Tree $_.FullName (Join-Path $dst $_.Name)
    } else {
      if (Should-SkipFile $_) { return }
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force
    }
  }
}

Write-Host "[2/4] Copiando projeto (com dist + node_modules)..."
Copy-Tree $projectRoot $stage

# Garante dists (Copy-Tree ja inclui pastas chamadas dist)
if (-not (Test-Path (Join-Path $stage 'frontend\dist\index.html'))) {
  throw 'Falha ao copiar frontend/dist'
}
if (-not (Test-Path (Join-Path $stage 'backend\dist\server.js'))) {
  throw 'Falha ao copiar backend/dist'
}

Write-Host "[3/4] Incluindo Node.js portatil $nodeVersion..."
$runtimeDir = Join-Path $stage '.runtime\node'
$nodeExe = Join-Path $runtimeDir 'node.exe'

if ($SkipNodeDownload -and (Test-Path (Join-Path $projectRoot '.runtime\node\node.exe'))) {
  Write-Host "  Copiando .runtime\node do projeto..."
  New-Item -ItemType Directory -Path (Split-Path $runtimeDir) -Force | Out-Null
  Copy-Item -Path (Join-Path $projectRoot '.runtime\node') -Destination $runtimeDir -Recurse -Force
} else {
  $tmpZip = Join-Path $env:TEMP $nodeZipName
  $tmpExtract = Join-Path $env:TEMP 'toolsdataweb-node-pack'
  Write-Host "  Download: $nodeUrl"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $tmpZip -UseBasicParsing
  if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
  Expand-Archive -LiteralPath $tmpZip -DestinationPath $tmpExtract -Force
  $extracted = Get-ChildItem $tmpExtract -Directory | Where-Object { $_.Name -like 'node-v*' } | Select-Object -First 1
  if (-not $extracted) { throw 'Zip do Node sem pasta esperada' }
  New-Item -ItemType Directory -Path (Split-Path $runtimeDir) -Force | Out-Null
  if (Test-Path $runtimeDir) { Remove-Item $runtimeDir -Recurse -Force }
  Move-Item -LiteralPath $extracted.FullName -Destination $runtimeDir
  Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $nodeExe)) {
  throw "Node portatil nao encontrado em $nodeExe"
}
$portableVer = & $nodeExe -v
Write-Host "  Node portatil OK: $portableVer"

$lerMe = @"
ToolsDataWeb - instalacao no cliente
=================================

1. Descompacte esta pasta onde quiser (ex.: Desktop\ToolsDataWeb).
2. De duplo clique em start.bat.
3. O navegador abre em http://localhost:3001

Este pacote JA inclui:
- Node.js portatil (nao precisa instalar Node no Windows)
- Dependencias (node_modules)
- Build pronto (frontend + backend)

Nao e necessario internet na primeira execucao (exceto se o antivirus
bloquear o Node ou a porta 3001).

Problemas: ver README.md na pasta.
"@
Set-Content -LiteralPath (Join-Path $stage 'LEIA-ME-CLIENTE.txt') -Value $lerMe -Encoding UTF8

if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Write-Host "[4/4] Compactando $zipPath ..."
# Compress-Archive engasga em arvores grandes; usa .NET ZipFile
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $stageRoot,
  $zipPath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

$bytes = (Get-Item -LiteralPath $zipPath).Length
$sizeMb = [math]::Round($bytes / 1MB, 2)
Write-Host ""
Write-Host "Pronto: $zipPath"
Write-Host ("Tamanho: {0} MB" -f $sizeMb)
Write-Host "Envie este zip; o cliente descompacta e roda start.bat (sem Node instalado)."

Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
exit 0
