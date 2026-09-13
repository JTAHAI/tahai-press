[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
  $package = Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json
  $version = [string]$package.version
  $cleanZip = "tahai-press_v$version`_clean-source.zip"
  $deployZip = "tahai-press_v$version`_cloudflare-deploy.zip"
  $cleanSha = "tahai-press_v$version`_clean-source.sha256"
  $deploySha = "tahai-press_v$version`_cloudflare-deploy.sha256"

  $excludePatterns = @(
    '^\.(git|artifacts|bootstrap)$',
    '^dist$',
    '^node_modules$',
    '^\.tmp-',
    '^SHA256SUMS\.txt$',
    '^tahai-press_v.+_(clean-source|cloudflare-deploy)\.zip$',
    '^tahai-press_v.+_(clean-source|cloudflare-deploy)\.sha256$',
    '^TAHAI_PRESS_v.+_(clean-source|cloudflare-direct-upload)\.zip$',
    '^apply-tahai-press-.+\.ps1$'
  )

  $cleanPaths = Get-ChildItem -Force | Where-Object {
    $name = $_.Name
    foreach ($pattern in $excludePatterns) {
      if ($name -match $pattern) { return $false }
    }
    return $true
  } | ForEach-Object { $_.FullName }

  if (Test-Path -LiteralPath $cleanZip) { Remove-Item -LiteralPath $cleanZip -Force }
  Compress-Archive -Path $cleanPaths -DestinationPath $cleanZip -CompressionLevel Optimal -Force

  if (Test-Path -LiteralPath $deployZip) { Remove-Item -LiteralPath $deployZip -Force }
  Compress-Archive -Path '.\dist\*' -DestinationPath $deployZip -CompressionLevel Optimal -Force

  $cleanHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $cleanZip).Hash
  $deployHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $deployZip).Hash
  Set-Content -LiteralPath $cleanSha -Value ("$cleanHash  $cleanZip")
  Set-Content -LiteralPath $deploySha -Value ("$deployHash  $deployZip")

  node scripts/create-release-proof.mjs
  $proofHash = (Get-FileHash -Algorithm SHA256 -LiteralPath '.\.artifacts\release-proof\tahai-press-release-proof.json').Hash
  Set-Content -LiteralPath 'SHA256SUMS.txt' -Value @(
    "$cleanHash  $cleanZip",
    "$deployHash  $deployZip",
    "$proofHash  .artifacts\release-proof\tahai-press-release-proof.json"
  )

  Write-Host "Packaged release artifacts for $version"
} finally {
  Pop-Location
}
