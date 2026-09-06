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

# Backstop for Deploy-Production.ps1's own image prune: catches images left
# behind by a deploy that failed before reaching that step, or by a local
# build, so a small production disk never fills silently between deploys.
# A prune failure should not stop the auth/outbox/mail-queue cleanup jobs
# below, so warn and continue rather than throw.
Write-Host 'Pruning Docker images and build cache older than 24h...' `
  -ForegroundColor Cyan

& docker image prune -af --filter 'until=24h' | Out-Null

if ($LASTEXITCODE -ne 0) {
  Write-Warning 'docker image prune failed; continuing with maintenance jobs.'
}

& docker builder prune -af --filter 'until=24h' | Out-Null

if ($LASTEXITCODE -ne 0) {
  Write-Warning 'docker builder prune failed; continuing with maintenance jobs.'
}

foreach ($Service in @('auth-cleanup', 'outbox-cleanup', 'mail-queue-cleanup')) {
  Write-Host "Running $Service..." -ForegroundColor Cyan
  & docker @Base $Service

  if ($LASTEXITCODE -ne 0) {
    throw "Maintenance service failed: $Service"
  }
}

Write-Host 'All maintenance jobs completed and heartbeats were recorded.' -ForegroundColor Green
