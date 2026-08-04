[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

if (-not (Test-Path -LiteralPath '.env.production' -PathType Leaf)) {
  throw '.env.production is missing.'
}

$Base = @(
  'compose',
  '--env-file', '.env.production',
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
