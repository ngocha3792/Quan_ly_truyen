[CmdletBinding()]
param(
  [string]$EnvironmentFile = '.env.production'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot =
  Split-Path -Parent (
    Split-Path -Parent $PSScriptRoot
  )

Set-Location $BackendRoot

$EnvironmentFilePath = if ([IO.Path]::IsPathRooted($EnvironmentFile)) {
  $EnvironmentFile
}
else {
  Join-Path $BackendRoot $EnvironmentFile
}

if (
  -not (
    Test-Path `
      -LiteralPath $EnvironmentFilePath `
      -PathType Leaf
  )
) {
  throw "Deployment environment file is missing: $EnvironmentFilePath"
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $Line =
    Get-Content -LiteralPath $EnvironmentFilePath |
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
    --env-file $EnvironmentFilePath `
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

$BackupOutput =
  Invoke-Compose `
    --profile maintenance `
    run `
    --rm `
    backup-postgres

$BackupOutput |
  ForEach-Object { Write-Host $_ }


# ------------------------------------------------------------
# 2. Identify the dump THIS run created
#
# Deliberately not "the newest .dump in the directory". A production
# deploy runs this same script (Invoke-Release.ps1 calls it before the
# readiness gate), so a scheduled backup and a deploy can overlap. With
# a directory scan each run picks up whichever dump finished last —
# including the other run's, whose .sha256 is not written yet — and
# fails with a checksum that was never missing.
#
# The container prints the path it wrote as its last line. That is the
# only handle that stays correct while another run is in flight.
# ------------------------------------------------------------

$DumpName =
  $BackupOutput |
  ForEach-Object {
    if ($_ -match 'Backup completed:\s*/backups/(?<name>[^/\s]+\.dump)\s*$') {
      $Matches['name']
    }
  } |
  Select-Object -Last 1

if (-not $DumpName) {
  throw 'Backup service completed but did not report the dump it wrote.'
}

$DumpPath =
  Join-Path `
    $BackupDirectory `
    $DumpName

if (
  -not (
    Test-Path `
      -LiteralPath $DumpPath `
      -PathType Leaf
  )
) {
  throw (
    "Backup service reported {0} but the file is missing: {1}" -f
    $DumpName,
    $DumpPath
  )
}

$DumpFile =
  Get-Item `
    -LiteralPath $DumpPath

$ChecksumFile =
  "$($DumpFile.FullName).sha256"

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

$Verification = & (
  Join-Path $PSScriptRoot 'Test-PostgresBackupArtifact.ps1'
) `
  -BackupFile $DumpFile.FullName `
  -EnvironmentFile $EnvironmentFilePath `
  -MaxAgeHours 2

Write-Host (
  "Local backup verified: {0} ({1} bytes)" -f
  $DumpFile.Name,
  $Verification.SizeBytes
) -ForegroundColor Green

function Write-BackupStatus {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$OffsiteVerified
  )

  $StatusPath =
    Join-Path `
      $BackupDirectory `
      'backup-last-success.json'

  $Status = [ordered]@{
    version         = 1
    completedAt     = [DateTime]::UtcNow.ToString('o')
    dumpFile        = $DumpFile.Name
    sizeBytes       = [long]$Verification.SizeBytes
    sha256          = [string]$Verification.Sha256
    offsiteVerified = $OffsiteVerified
  }

  $StatusJson = $Status | ConvertTo-Json
  $TemporaryStatusPath = "$StatusPath.tmp"

  [IO.File]::WriteAllText(
    $TemporaryStatusPath,
    $StatusJson + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false)
  )

  Move-Item `
    -LiteralPath $TemporaryStatusPath `
    -Destination $StatusPath `
    -Force
}


# ------------------------------------------------------------
# 3. Initialize/check encrypted off-host repository
# ------------------------------------------------------------

$OffsiteEnabled =
  Get-EnvValue `
    -Name 'OFFSITE_BACKUP_ENABLED'

if (
  $OffsiteEnabled -ne 'true'
) {
  Write-BackupStatus -OffsiteVerified $false

  Write-Host `
    'Off-site backup is disabled. Local PostgreSQL backup completed.' `
    -ForegroundColor Yellow

  return
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
  --env-file $EnvironmentFilePath `
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
  "/backups/$($DumpFile.Name)"

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

Write-BackupStatus -OffsiteVerified $true


Write-Host `
  'PostgreSQL local + encrypted off-host backup completed successfully.' `
  -ForegroundColor Green
