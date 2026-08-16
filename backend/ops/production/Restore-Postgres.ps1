[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [Parameter(Mandatory = $true)]
  [string]$ConfirmDatabaseName,

  [string]$EnvironmentFile = '.env.production',

  [switch]$SkipSafetyBackup
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

function Get-EnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  $Line = Get-Content -LiteralPath $EnvironmentFilePath |
    Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
    Select-Object -Last 1

  if (-not $Line) {
    throw "Missing $Name in $EnvironmentFilePath"
  }

  $Value = $Line.Substring($Name.Length + 1).Trim()

  if (
    ($Value.StartsWith("'") -and $Value.EndsWith("'")) -or
    ($Value.StartsWith('"') -and $Value.EndsWith('"'))
  ) {
    return $Value.Substring(1, $Value.Length - 2)
  }

  return $Value
}

$ResolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$DatabaseName = Get-EnvValue -Name 'POSTGRES_DB'
$PostgresUser = Get-EnvValue -Name 'POSTGRES_USER'
$EnvironmentName = Get-EnvValue -Name 'DEPLOYMENT_ENVIRONMENT'

if ([string]::IsNullOrWhiteSpace($EnvironmentName)) {
  $EnvironmentName = 'production'
}

if ($ConfirmDatabaseName -cne $DatabaseName) {
  throw "Confirmation mismatch for target environment '$EnvironmentName'. Expected database name: $DatabaseName"
}

Write-Host "Target environment: $EnvironmentName | Target database: $DatabaseName" -ForegroundColor Yellow
Write-Host 'Validating backup checksum and archive structure...' -ForegroundColor Cyan

& (Join-Path $PSScriptRoot 'Test-PostgresBackupArtifact.ps1') `
  -BackupFile $ResolvedBackup `
  -EnvironmentFile $EnvironmentFilePath `
  -SkipAgeCheck |
Out-Null

if (-not $PSCmdlet.ShouldProcess("$DatabaseName ($EnvironmentName)", "Restore from $ResolvedBackup")) {
  return
}

if (-not $SkipSafetyBackup) {
  & (Join-Path $PSScriptRoot 'Backup-Postgres.ps1') -EnvironmentFile $EnvironmentFilePath
}

$ComposePrefix = @(
  'compose', '--env-file', $EnvironmentFilePath, '-f', 'compose.production.yml'
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
