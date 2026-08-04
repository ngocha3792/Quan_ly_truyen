[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

if (-not (Test-Path -LiteralPath '.env.production' -PathType Leaf)) {
  throw '.env.production is missing.'
}

New-Item -ItemType Directory -Path (Join-Path $BackendRoot 'backups') -Force | Out-Null

& docker compose `
  --env-file .env.production `
  -f compose.production.yml `
  --profile maintenance `
  run --rm backup-postgres

if ($LASTEXITCODE -ne 0) {
  throw 'PostgreSQL backup failed.'
}

Write-Host 'PostgreSQL backup and pg_restore verification completed.' -ForegroundColor Green
