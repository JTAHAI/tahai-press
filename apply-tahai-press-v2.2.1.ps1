[CmdletBinding()]
param(
  [string]$SourceZip = (Join-Path $PSScriptRoot 'tahai-press_v2.2.1_cloudflare-deploy.zip'),
  [string]$Destination = (Join-Path $PSScriptRoot 'apply-tahai-press-v2.2.1')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SourceZip)) {
  throw "Source ZIP not found: $SourceZip"
}

if (Test-Path -LiteralPath $Destination) {
  Remove-Item -LiteralPath $Destination -Recurse -Force
}

Expand-Archive -LiteralPath $SourceZip -DestinationPath $Destination -Force
Write-Host "Applied $SourceZip to $Destination"
