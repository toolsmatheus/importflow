# Aguarda o backend responder /api/health e abre o navegador na interface.
param(
  [int]$Port = 3001,
  [int]$TimeoutSec = 120
)

$healthUrl = "http://localhost:$Port/api/health"
$appUrl = "http://localhost:$Port/"

for ($i = 0; $i -lt $TimeoutSec; $i++) {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Start-Process $appUrl
      exit 0
    }
  } catch {
    # servidor ainda subindo
  }
  Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "ImportFlow: o servidor demorou mais que ${TimeoutSec}s para responder."
Write-Host "Abra manualmente no navegador: $appUrl"
exit 1
