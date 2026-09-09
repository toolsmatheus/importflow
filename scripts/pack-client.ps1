# Gera um zip leve do ImportFlow para enviar ao cliente (AnyDesk / pen drive).
# Exclui node_modules, dist, .git, .runtime, xlsx fonte, etc.
# O cliente descompacta e executa start.bat (baixa Node + npm install + build na maquina dele).
param(
  [string]$OutDir = "",
  [string]$ZipName = "ImportFlow-cliente.zip"
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $projectRoot 'dist-client' }

$stage = Join-Path $OutDir '_stage'
$zipPath = Join-Path $OutDir $ZipName

Write-Host "Empacotando ImportFlow (cliente)..."
Write-Host "Origem: $projectRoot"

if (Test-Path -LiteralPath $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$excludeDirNames = @(
  'node_modules', 'dist', 'dist-client', '.git', '.runtime', 'temp',
  '.cursor', 'agent-transcripts', 'coverage', '.vite', 'Downloads'
)
$excludeFileGlobs = @(
  '*.xlsx', '*.log', '.env', '.env.local', 'Thumbs.db', '.DS_Store'
)

function Should-SkipDir([System.IO.DirectoryInfo]$dir) {
  return $excludeDirNames -contains $dir.Name
}

function Should-SkipFile([System.IO.FileInfo]$file) {
  foreach ($g in $excludeFileGlobs) {
    if ($file.Name -like $g) { return $true }
  }
  # Fontes grandes / regeneraveis (xlsx ja coberto); samples opcionais grandes nao ha
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

Copy-Tree $projectRoot (Join-Path $stage 'ImportFlow')

# Instrucao curta no zip
$lerMe = @"
ImportFlow - instalacao no cliente
=================================

1. Descompacte esta pasta onde quiser (ex.: Desktop\ImportFlow).
2. Dê duplo clique em start.bat.
3. Na primeira vez o script:
   - garante Node.js 20+ (baixa portatil se precisar)
   - instala dependencias (internet)
   - gera o build
   - abre http://localhost:3001

Nao e necessario enviar node_modules nem instalar Node manualmente
(se a internet estiver ok).

Problemas: ver README.md na pasta.
"@
Set-Content -LiteralPath (Join-Path $stage 'ImportFlow\LEIA-ME-CLIENTE.txt') -Value $lerMe -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

Write-Host "Compactando $zipPath ..."
Compress-Archive -Path (Join-Path $stage 'ImportFlow') -DestinationPath $zipPath -CompressionLevel Optimal

$bytes = (Get-Item -LiteralPath $zipPath).Length
$sizeMb = [math]::Round($bytes / 1MB, 2)
Write-Host ""
Write-Host "Pronto: $zipPath"
Write-Host ("Tamanho: {0} MB" -f $sizeMb)
Write-Host "Envie este zip via AnyDesk; o cliente descompacta e roda start.bat."

Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
exit 0
