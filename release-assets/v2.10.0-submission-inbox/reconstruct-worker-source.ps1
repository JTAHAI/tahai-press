param(
  [string]$OutputPath = (Join-Path $PSScriptRoot 'TAHAI_PRESS_V2.10.0_SUBMISSION_INBOX_WORKER_SOURCE.zip')
)
$Parts = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'worker-source') -Filter 'part-*.b64part' | Sort-Object Name)
if ($Parts.Count -eq 0) { throw 'No worker-source Base64 parts were found.' }
$Encoded = (($Parts | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join '')
[IO.File]::WriteAllBytes($OutputPath, [Convert]::FromBase64String(($Encoded -replace '\s','')))
$Expected = '0ce2223c13f759c7be40bc82f583d99f90546f14f96dffe95e97fa000ebb1a38'
$Actual = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($Actual -ne $Expected) { throw "Checksum mismatch: $Actual" }
Write-Host "Reconstructed and verified: $OutputPath"
