[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot =
  Split-Path -Parent (
    Split-Path -Parent $PSScriptRoot
  )

Set-Location $BackendRoot

$EnvironmentFile =
  Join-Path $BackendRoot '.env.production'

if (
  -not (
    Test-Path `
      -LiteralPath $EnvironmentFile `
      -PathType Leaf
  )
) {
  throw '.env.production is missing.'
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $Line =
    Get-Content -LiteralPath $EnvironmentFile |
    Where-Object {
      $_ -match "^$([regex]::Escape($Name))="
    } |
    Select-Object -Last 1

  if (-not $Line) {
    return $null
  }

  $Value =
    $Line.Substring(
      $Name.Length + 1
    ).Trim()

  if (
    ($Value.StartsWith("'") -and $Value.EndsWith("'")) -or
    ($Value.StartsWith('"') -and $Value.EndsWith('"'))
  ) {
    return $Value.Substring(
      1,
      $Value.Length - 2
    )
  }

  return $Value
}

function Invoke-Compose {
  param(
    [Parameter(
      Mandatory = $true,
      ValueFromRemainingArguments = $true
    )]
    [string[]]$Arguments
  )

  & docker compose `
    --env-file .env.production `
    -f compose.production.yml `
    @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw (
      "docker compose failed: {0}" -f
      ($Arguments -join ' ')
    )
  }
}

$BackupDirectoryValue =
  Get-EnvValue `
    -Name 'POSTGRES_BACKUP_DIRECTORY'

if (
  [string]::IsNullOrWhiteSpace(
    $BackupDirectoryValue
  )
) {
  $BackupDirectoryValue =
    './backups'
}

$BackupDirectory =
  if (
    [IO.Path]::IsPathRooted(
      $BackupDirectoryValue
    )
  ) {
    $BackupDirectoryValue
  } else {
    Join-Path `
      $BackendRoot `
      $BackupDirectoryValue
  }

New-Item `
  -ItemType Directory `
  -Path $BackupDirectory `
  -Force |
Out-Null


# ------------------------------------------------------------
# 1. Local PostgreSQL dump
# ------------------------------------------------------------

Write-Host `
  'Creating local PostgreSQL backup...' `
  -ForegroundColor Cyan

Invoke-Compose `
  --profile maintenance `
  run `
  --rm `
  backup-postgres


# ------------------------------------------------------------
# 2. Locate newly-created dump
# ------------------------------------------------------------

$LatestDump =
  Get-ChildItem `
    -LiteralPath $BackupDirectory `
    -Filter '*.dump' `
    -File |
  Sort-Object `
    LastWriteTimeUtc `
    -Descending |
  Select-Object -First 1

if (-not $LatestDump) {
  throw 'Backup service completed but no .dump file was found.'
}

$ChecksumFile =
  "$($LatestDump.FullName).sha256"

if (
  -not (
    Test-Path `
      -LiteralPath $ChecksumFile `
      -PathType Leaf
  )
) {
  throw (
    "Backup checksum is missing: {0}" -f
    $ChecksumFile
  )
}

Write-Host (
  "Local backup verified: {0}" -f
  $LatestDump.Name
) -ForegroundColor Green


# ------------------------------------------------------------
# 3. Initialize/check encrypted off-host repository
# ------------------------------------------------------------

$OffsiteEnabled =
  Get-EnvValue `
    -Name 'OFFSITE_BACKUP_ENABLED'

if (
  $OffsiteEnabled -ne 'true'
) {
  Write-Host `
    'Off-site backup is disabled. Local PostgreSQL backup completed.' `
    -ForegroundColor Yellow

  exit 0
}

$ResticImage =
  Get-EnvValue -Name 'RESTIC_IMAGE'

$ResticRepository =
  Get-EnvValue -Name 'RESTIC_REPOSITORY'

$S3AccessKey =
  Get-EnvValue -Name 'BACKUP_S3_ACCESS_KEY_ID'

$S3SecretKey =
  Get-EnvValue -Name 'BACKUP_S3_SECRET_ACCESS_KEY'

if ([string]::IsNullOrWhiteSpace($ResticImage)) {
  throw 'RESTIC_IMAGE is required when OFFSITE_BACKUP_ENABLED=true.'
}

if ([string]::IsNullOrWhiteSpace($ResticRepository)) {
  throw 'RESTIC_REPOSITORY is required when OFFSITE_BACKUP_ENABLED=true.'
}

if ([string]::IsNullOrWhiteSpace($S3AccessKey)) {
  throw 'BACKUP_S3_ACCESS_KEY_ID is required when OFFSITE_BACKUP_ENABLED=true.'
}

if ([string]::IsNullOrWhiteSpace($S3SecretKey)) {
  throw 'BACKUP_S3_SECRET_ACCESS_KEY is required when OFFSITE_BACKUP_ENABLED=true.'
}

Write-Host `
  'Checking encrypted off-host backup repository...' `
  -ForegroundColor Cyan

& docker compose `
  --env-file .env.production `
  -f compose.production.yml `
  --profile maintenance `
  run `
  --rm `
  --no-deps `
  backup-offsite `
  snapshots `
  --compact

if ($LASTEXITCODE -ne 0) {
  Write-Host `
    'Repository is unavailable or not initialized. Attempting initialization...' `
    -ForegroundColor Yellow

  Invoke-Compose `
    --profile maintenance `
    run `
    --rm `
    --no-deps `
    backup-offsite `
    init
}


# ------------------------------------------------------------
# 4. Upload ONLY the newly-created dump + checksum
#
# Restic encrypts data client-side before object storage upload.
# ------------------------------------------------------------

$DumpContainerPath =
  "/backups/$($LatestDump.Name)"

$ChecksumContainerPath =
  "$DumpContainerPath.sha256"

Write-Host `
  'Uploading encrypted backup to off-host storage...' `
  -ForegroundColor Cyan

Invoke-Compose `
  --profile maintenance `
  run `
  --rm `
  --no-deps `
  backup-offsite `
  backup `
  $DumpContainerPath `
  $ChecksumContainerPath `
  --tag postgres


# ------------------------------------------------------------
# 5. Off-host retention
# ------------------------------------------------------------

$KeepDaily =
  Get-EnvValue -Name 'RESTIC_KEEP_DAILY'

$KeepWeekly =
  Get-EnvValue -Name 'RESTIC_KEEP_WEEKLY'

$KeepMonthly =
  Get-EnvValue -Name 'RESTIC_KEEP_MONTHLY'

if (-not $KeepDaily) {
  $KeepDaily = '14'
}

if (-not $KeepWeekly) {
  $KeepWeekly = '8'
}

if (-not $KeepMonthly) {
  $KeepMonthly = '12'
}

Write-Host `
  'Applying encrypted repository retention policy...' `
  -ForegroundColor Cyan

Invoke-Compose `
  --profile maintenance `
  run `
  --rm `
  --no-deps `
  backup-offsite `
  forget `
  --tag postgres `
  --keep-daily $KeepDaily `
  --keep-weekly $KeepWeekly `
  --keep-monthly $KeepMonthly `
  --prune


# ------------------------------------------------------------
# 6. Repository metadata integrity
# ------------------------------------------------------------

Write-Host `
  'Checking off-host repository integrity...' `
  -ForegroundColor Cyan

Invoke-Compose `
  --profile maintenance `
  run `
  --rm `
  --no-deps `
  backup-offsite `
  check


Write-Host `
  'PostgreSQL local + encrypted off-host backup completed successfully.' `
  -ForegroundColor Green
