[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

$EnvironmentFile = Join-Path $BackendRoot '.env.production'

if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
  throw '.env.production is missing.'
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $Line = Get-Content -LiteralPath $EnvironmentFile |
    Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
    Select-Object -Last 1

  if (-not $Line) {
    return $null
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

function Resolve-BackupDirectory {
  $Configured = Get-EnvValue -Name 'POSTGRES_BACKUP_DIRECTORY'

  if ([string]::IsNullOrWhiteSpace($Configured)) {
    $Configured = './backups'
  }

  if ([IO.Path]::IsPathRooted($Configured)) {
    return $Configured
  }

  return Join-Path $BackendRoot $Configured
}

function Read-StatusFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Name status file is missing: $Path"
  }

  try {
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  }
  catch {
    throw "$Name status file is invalid JSON: $Path"
  }
}

$BackupDirectory = Resolve-BackupDirectory
$BackupStatusPath = Join-Path $BackupDirectory 'backup-last-success.json'
$RestoreStatusPath = Join-Path $BackupDirectory 'restore-drill/restore-drill-last-success.json'

$BackupRpoHours = Get-EnvValue -Name 'BACKUP_RPO_HOURS'
$RestoreDrillMaxAgeDays = Get-EnvValue -Name 'RESTORE_DRILL_MAX_AGE_DAYS'
$OffsiteEnabled = (Get-EnvValue -Name 'OFFSITE_BACKUP_ENABLED') -eq 'true'

if (-not $BackupRpoHours) {
  $BackupRpoHours = '26'
}

if (-not $RestoreDrillMaxAgeDays) {
  $RestoreDrillMaxAgeDays = '8'
}

$BackupStatus = Read-StatusFile -Path $BackupStatusPath -Name 'Backup'
$RestoreStatus = Read-StatusFile -Path $RestoreStatusPath -Name 'Restore drill'

$BackupCompletedAt = [DateTime]::Parse($BackupStatus.completedAt).ToUniversalTime()
$RestoreCompletedAt = [DateTime]::Parse($RestoreStatus.completedAt).ToUniversalTime()
$Now = [DateTime]::UtcNow
$BackupAgeHours = ($Now - $BackupCompletedAt).TotalHours
$RestoreAgeDays = ($Now - $RestoreCompletedAt).TotalDays

if ($BackupAgeHours -gt [double]$BackupRpoHours) {
  throw (
    'Backup RPO violated. AgeHours={0:N2} ObjectiveHours={1}' -f
      $BackupAgeHours,
      $BackupRpoHours
  )
}

if ($OffsiteEnabled -and $BackupStatus.offsiteVerified -ne $true) {
  throw 'Latest backup did not complete encrypted off-site verification.'
}

if ($RestoreAgeDays -gt [double]$RestoreDrillMaxAgeDays) {
  throw (
    'Restore drill objective violated. AgeDays={0:N2} ObjectiveDays={1}' -f
      $RestoreAgeDays,
      $RestoreDrillMaxAgeDays
  )
}

Write-Host (
  'Recovery readiness passed. BackupAgeHours={0:N2} RestoreDrillAgeDays={1:N2} OffsiteRequired={2}' -f
    $BackupAgeHours,
    $RestoreAgeDays,
    $OffsiteEnabled
) -ForegroundColor Green
