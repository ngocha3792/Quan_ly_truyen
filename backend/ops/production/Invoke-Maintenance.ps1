[CmdletBinding()]
param(
  [string]$EnvironmentFile = '.env.production'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

$EnvironmentFilePath = if ([IO.Path]::IsPathRooted($EnvironmentFile)) {
  $EnvironmentFile
}
else {
  Join-Path $BackendRoot $EnvironmentFile
}

if (-not (Test-Path -LiteralPath $EnvironmentFilePath -PathType Leaf)) {
  throw "Deployment environment file is missing: $EnvironmentFilePath"
}

$Base = @(
  'compose',
  '--env-file', $EnvironmentFilePath,
  '-f', 'compose.production.yml',
  '--profile', 'maintenance',
  'run', '--rm'
)

foreach ($Service in @('auth-cleanup', 'outbox-cleanup', 'mail-queue-cleanup')) {
  Write-Host "Running $Service..." -ForegroundColor Cyan
  & docker @Base $Service

  if ($LASTEXITCODE -ne 0) {
    throw "Maintenance service failed: $Service"
  }
}

Write-Host 'All maintenance jobs completed and heartbeats were recorded.' -ForegroundColor Green
