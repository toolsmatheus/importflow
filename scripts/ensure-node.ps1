# Garante Node.js >= MinMajor para o ImportFlow.
# Preferencia: Node do PATH se OK; senao runtime portatil em .runtime\node (sem admin).
# Escreve .runtime\use-node.cmd para o start.bat carregar no PATH da sessao.
param(
  [int]$MinMajor = 20,
  [string]$RuntimeRoot = ""
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) {
  Write-Host $Message
}

function Get-NodeMajor([string]$NodeExe) {
  try {
    $raw = & $NodeExe -v 2>$null
    if (-not $raw) { return -1 }
    $m = [regex]::Match([string]$raw, 'v?(\d+)')
    if (-not $m.Success) { return -1 }
    return [int]$m.Groups[1].Value
  } catch {
    return -1
  }
}

function Test-NodeOk([string]$NodeExe) {
  if (-not $NodeExe) { return $false }
  if (-not (Test-Path -LiteralPath $NodeExe)) { return $false }
  return (Get-NodeMajor $NodeExe) -ge $MinMajor
}

function Refresh-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Resolve-SystemNode {
  Refresh-SessionPath
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  return $null
}

function Write-UseNodeCmd([string]$BinDir) {
  $runtimeParent = Split-Path -Parent $BinDir
  if (-not (Test-Path -LiteralPath $runtimeParent)) {
    New-Item -ItemType Directory -Path $runtimeParent -Force | Out-Null
  }
  $cmdPath = Join-Path $runtimeParent 'use-node.cmd'
  $lines = @(
    '@echo off'
    'REM Gerado por ensure-node.ps1 - nao editar'
    ('set "PATH={0};%PATH%"' -f $BinDir)
  )
  Set-Content -LiteralPath $cmdPath -Value $lines -Encoding ASCII
  return $cmdPath
}

function Write-EmptyUseNodeCmd {
  $runtimeParent = Join-Path $projectRoot '.runtime'
  if (-not (Test-Path -LiteralPath $runtimeParent)) {
    New-Item -ItemType Directory -Path $runtimeParent -Force | Out-Null
  }
  $cmdPath = Join-Path $runtimeParent 'use-node.cmd'
  $lines = @(
    '@echo off'
    'REM Sistema ja tem Node adequado - nada a alterar no PATH'
  )
  Set-Content -LiteralPath $cmdPath -Value $lines -Encoding ASCII
}

if (-not $RuntimeRoot) {
  $RuntimeRoot = Join-Path (Split-Path -Parent $PSScriptRoot) '.runtime\node'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeParent = Join-Path $projectRoot '.runtime'
$portableNode = Join-Path $RuntimeRoot 'node.exe'

Write-Info ("Verificando Node.js (minimo v{0})..." -f $MinMajor)

# 1) PATH do sistema ja OK
$systemNode = Resolve-SystemNode
if (Test-NodeOk $systemNode) {
  $ver = & $systemNode -v
  Write-Info ("Node do sistema OK: {0} ({1})" -f $ver, $systemNode)
  Write-EmptyUseNodeCmd
  exit 0
}

if ($systemNode) {
  $cur = & $systemNode -v 2>$null
  Write-Info ("Node do sistema insuficiente: {0} (precisa v{1}+)." -f $cur, $MinMajor)
} else {
  Write-Info 'Node.js nao encontrado no PATH.'
}

# 2) Runtime portatil ja baixado
if (Test-NodeOk $portableNode) {
  $ver = & $portableNode -v
  Write-Info ("Usando Node portatil: {0}" -f $ver)
  [void](Write-UseNodeCmd $RuntimeRoot)
  exit 0
}

# 3) Baixar Node LTS (serie MinMajor) portatil - sem instalador / sem admin
Write-Info ("Baixando Node.js {0} LTS portatil (pode demorar na primeira vez)..." -f $MinMajor)

$arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'arm64' }

$indexUrl = 'https://nodejs.org/dist/index.json'
try {
  $index = Invoke-RestMethod -Uri $indexUrl -UseBasicParsing -TimeoutSec 60
} catch {
  Write-Host ("[ERRO] Nao foi possivel consultar nodejs.org: {0}" -f $_.Exception.Message)
  Write-Host ("Verifique a internet ou instale Node {0} LTS manualmente: https://nodejs.org/" -f $MinMajor)
  exit 1
}

$release = $index |
  Where-Object {
    $_.version -match ("^v{0}\." -f $MinMajor) -and
    $_.files -contains ("win-{0}-zip" -f $arch)
  } |
  Select-Object -First 1

if (-not $release) {
  Write-Host ("[ERRO] Nao achei build win-{0} para Node v{1} em nodejs.org." -f $arch, $MinMajor)
  exit 1
}

$version = [string]$release.version
$zipName = "node-$version-win-$arch.zip"
$zipUrl = "https://nodejs.org/dist/$version/$zipName"
$staging = Join-Path $runtimeParent 'staging'
$zipPath = Join-Path $staging $zipName

if (Test-Path -LiteralPath $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

Write-Info ("Download: {0}" -f $zipUrl)
try {
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
} catch {
  Write-Host ("[ERRO] Falha no download do Node: {0}" -f $_.Exception.Message)
  Write-Host ("Instale manualmente: https://nodejs.org/ (Node {0} LTS)" -f $MinMajor)
  exit 1
}

Write-Info 'Extraindo...'
Expand-Archive -LiteralPath $zipPath -DestinationPath $staging -Force

$extracted = Get-ChildItem -LiteralPath $staging -Directory |
  Where-Object { $_.Name -like 'node-v*' } |
  Select-Object -First 1

if (-not $extracted) {
  Write-Host '[ERRO] Zip do Node sem pasta esperada.'
  exit 1
}

if (Test-Path -LiteralPath $RuntimeRoot) {
  Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force
}
New-Item -ItemType Directory -Path (Split-Path -Parent $RuntimeRoot) -Force | Out-Null
Move-Item -LiteralPath $extracted.FullName -Destination $RuntimeRoot

Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue

$portableExe = Join-Path $RuntimeRoot 'node.exe'
if (-not (Test-NodeOk $portableExe)) {
  Write-Host '[ERRO] Node portatil instalado mas nao responde a versao minima.'
  exit 1
}

$ver = & $portableExe -v
Write-Info ("Node portatil pronto: {0}" -f $ver)
[void](Write-UseNodeCmd $RuntimeRoot)
exit 0
