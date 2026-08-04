param(
  [string]$OutputPath = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $Root "TAHAI_PRESS_THEME_FINAL_OVERLAY_v1.4.0.zip"
}
$Parts = Get-ChildItem -LiteralPath (Join-Path $Root "artifacts\overlay-v1.4.0") -Filter "part-*.b64part" | Sort-Object Name
if (-not $Parts) { throw "Release chunks were not found." }
$Builder = [System.Text.StringBuilder]::new()
foreach ($Part in $Parts) {
  [void]$Builder.Append([System.IO.File]::ReadAllText($Part.FullName))
}
[System.IO.File]::WriteAllBytes($OutputPath, [Convert]::FromBase64String($Builder.ToString()))
$Hash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$Expected = "8c17e366e49d497a3fe07482bbd02c72af0ed10d5af51a10d91b6f13c91c1e30"
if ($Hash -ne $Expected) { throw "Checksum mismatch: $Hash" }
Write-Host "Reconstructed and verified: $OutputPath"
