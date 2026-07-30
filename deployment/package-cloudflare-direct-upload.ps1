[CmdletBinding()]
param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
  $package = Get-Content -LiteralPath ".\package.json" -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $RepoRoot ("tahai-press_v{0}_cloudflare-deploy.zip" -f $package.version)
  }

  npm run build:cloudflare
  if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }

  # Compress the contents of dist, not the dist directory itself, so index.html is at ZIP root.
  Compress-Archive -Path ".\dist\*" -DestinationPath $OutputPath -CompressionLevel Optimal -Force
  Write-Host "Cloudflare Pages direct-upload ZIP: $OutputPath"
} finally {
  Pop-Location
}
