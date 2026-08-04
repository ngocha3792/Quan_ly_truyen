[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [Parameter(Mandatory = $true)]
  [string]$ConfirmDatabaseName,

  [switch]$SkipSafetyBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

function Get-EnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  $Line = Get-Content -LiteralPath '.env.production' |
    Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
    Select-Object -Last 1

  if (-not $Line) {
    throw "Missing $Name in .env.production"
  }

  return $Line.Substring($Name.Length + 1)
}

if (-not (Test-Path -LiteralPath '.env.production' -PathType Leaf)) {
  throw '.env.production is missing.'
}

$ResolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$DatabaseName = Get-EnvValue -Name 'POSTGRES_DB'
$PostgresUser = Get-EnvValue -Name 'POSTGRES_USER'

if ($ConfirmDatabaseName -cne $DatabaseName) {
  throw "Confirmation mismatch. Expected database name: $DatabaseName"
}

if (-not $PSCmdlet.ShouldProcess($DatabaseName, "Restore from $ResolvedBackup")) {
  return
}

if (-not $SkipSafetyBackup) {
  & (Join-Path $PSScriptRoot 'Backup-Postgres.ps1')
}

$ComposePrefix = @(
  'compose', '--env-file', '.env.production', '-f', 'compose.production.yml'
)

Write-Host 'Stopping traffic and background processing...' -ForegroundColor Yellow
& docker @ComposePrefix stop caddy api worker

if ($LASTEXITCODE -ne 0) {
  throw 'Unable to stop application services.'
}

$ContainerBackupPath = '/restore/restore.dump'
$Mount = "${ResolvedBackup}:${ContainerBackupPath}:ro"

Write-Host 'Restoring PostgreSQL database...' -ForegroundColor Yellow
& docker @ComposePrefix --profile maintenance run --rm `
  --volume $Mount `
  --entrypoint pg_restore `
  backup-postgres `
  --host=postgres `
  "--username=$PostgresUser" `
  "--dbname=$DatabaseName" `
  --clean `
  --if-exists `
  --no-owner `
  --no-privileges `
  --exit-on-error `
  $ContainerBackupPath

if ($LASTEXITCODE -ne 0) {
  throw 'Database restore failed. Application services remain stopped.'
}

Write-Host 'Starting application after restore...' -ForegroundColor Cyan
& docker @ComposePrefix up -d --wait api worker caddy

if ($LASTEXITCODE -ne 0) {
  throw 'Database restored, but application startup failed.'
}

& docker @ComposePrefix --profile tools run --rm gate-postdeploy

if ($LASTEXITCODE -ne 0) {
  throw 'Database restored, but postdeploy gate failed.'
}

Write-Host 'Database restore completed and postdeploy gate passed.' -ForegroundColor Green
