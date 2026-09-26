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
# Local retention
#
# The backup container already prunes /backups, but on the wrong axis:
# `find -mtime +$BACKUP_RETENTION_DAYS` is an age floor, and backups run
# several times a day. Fourteen days of them is tens of gigabytes, so the
# disk filled and took a deploy down with it long before any file was old
# enough to be swept. The bound has to be a count, not an age.
#
# Two rules make deleting a backup safe to automate:
#   * never delete a dump that is not confirmed present off-host, and
#   * never delete a dump whose .sha256 is still missing, because that
#     is a concurrent run mid-write, not a leftover (a scheduled backup
#     and a deploy can overlap — see the note in section 2).
# ------------------------------------------------------------

function Get-OffsiteDumpName {
  <#
    .SYNOPSIS
    Basenames of every .dump restic currently holds under the postgres tag.

    Returns $null — not an empty list — when the repository cannot be
    read or parsed. The caller must treat that as "delete nothing":
    an empty list would otherwise read as "off-host holds nothing",
    which is the one case where deleting local copies loses data.
  #>

  $Output =
    Invoke-Compose `
      --profile maintenance `
      run `
      --rm `
      --no-deps `
      backup-offsite `
      snapshots `
      --tag postgres `
      --json

  $Text = ($Output -join "`n")
  $Start = $Text.IndexOf('[')
  $End = $Text.LastIndexOf(']')

  if ($Start -lt 0 -or $End -le $Start) {
    Write-Host `
      'Could not read the off-host snapshot list; keeping every local dump.' `
      -ForegroundColor Yellow

    return $null
  }

  try {
    $Snapshots =
      $Text.Substring($Start, $End - $Start + 1) |
      ConvertFrom-Json
  }
  catch {
    Write-Host `
      "Could not parse the off-host snapshot list ($($_.Exception.Message)); keeping every local dump." `
      -ForegroundColor Yellow

    return $null
  }

  $Names = [Collections.Generic.List[string]]::new()

  foreach ($Snapshot in $Snapshots) {
    foreach ($SnapshotPath in $Snapshot.paths) {
      if ($SnapshotPath -match '(?<name>[^/\\]+\.dump)$') {
        $Names.Add($Matches['name'])
      }
    }
  }

  # The comma is load-bearing. Returning the list bare lets PowerShell
  # unroll it, which collapses an empty list to no output at all — and
  # then "off-host holds nothing" arrives at the caller looking exactly
  # like "the repository could not be read". Those must stay separable:
  # one of them is the state where deleting local dumps loses data.
  return ,$Names
}

function Remove-SupersededLocalBackup {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Keep,

    # $null means the off-host list is unknown, so nothing is deleted.
    # An empty list means off-host genuinely holds no dump, which also
    # deletes nothing.
    [AllowNull()]
    [AllowEmptyCollection()]
    [Collections.Generic.List[string]]$OffsiteDumpName
  )

  # Sorted by filename, not by mtime: the name carries the UTC stamp of
  # the dump itself, while mtime moves again when the checksum pass
  # rewrites nothing but still touches the directory entry.
  $Dumps =
    Get-ChildItem -LiteralPath $BackupDirectory -Filter '*.dump' -File |
    Sort-Object -Property Name -Descending

  if ($Dumps.Count -le $Keep) {
    return
  }

  $Candidates = $Dumps | Select-Object -Skip $Keep
  $RemovedCount = 0
  $RemovedBytes = [long]0

  foreach ($Candidate in $Candidates) {
    if ($Candidate.Name -eq $DumpFile.Name) {
      # Belt and braces: this run's own dump sorts newest, so $Keep >= 1
      # already excludes it.
      continue
    }

    $ChecksumPath = "$($Candidate.FullName).sha256"

    if (-not (Test-Path -LiteralPath $ChecksumPath -PathType Leaf)) {
      Write-Host `
        "Keeping $($Candidate.Name): checksum not written yet (another run may be in flight)." `
        -ForegroundColor Yellow

      continue
    }

    if ($null -eq $OffsiteDumpName -or -not $OffsiteDumpName.Contains($Candidate.Name)) {
      Write-Host `
        "Keeping $($Candidate.Name): no confirmed off-host copy." `
        -ForegroundColor Yellow

      continue
    }

    $RemovedBytes += $Candidate.Length
    Remove-Item -LiteralPath $Candidate.FullName -Force
    Remove-Item -LiteralPath $ChecksumPath -Force
    $RemovedCount++
  }

  if ($RemovedCount -gt 0) {
    Write-Host (
      'Local retention removed {0} superseded dump(s), {1:N0} MiB reclaimed.' -f
      $RemovedCount,
      ($RemovedBytes / 1MB)
    ) -ForegroundColor Green
  }
}

function Remove-StaleLocalTempFile {
  <#
    .SYNOPSIS
    Clears .tmp files a previous run could not finish writing.

    A full disk leaves a zero-byte backup-last-success.json.tmp behind;
    it is never read, but it hides the real reason the marker went
    stale from anyone reading the directory.
  #>

  $Cutoff = [DateTime]::UtcNow.AddHours(-1)

  Get-ChildItem -LiteralPath $BackupDirectory -Filter '*.tmp' -File |
    Where-Object { $_.LastWriteTimeUtc -lt $Cutoff } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
}

function Get-LocalBackupKeepCount {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Default
  )

  $Configured = Get-EnvValue -Name 'POSTGRES_LOCAL_BACKUP_KEEP'
  $Parsed = 0

  if (
    -not [string]::IsNullOrWhiteSpace($Configured) -and
    [int]::TryParse($Configured, [ref]$Parsed) -and
    $Parsed -ge 1
  ) {
    return $Parsed
  }

  return $Default
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
  Remove-StaleLocalTempFile
  Write-BackupStatus -OffsiteVerified $false

  Write-Host `
    'Off-site backup is disabled. Local PostgreSQL backup completed.' `
    -ForegroundColor Yellow

  Write-Host (
    'Local dumps are never pruned while off-site backup is disabled: ' +
    'they are the only copy. {0} currently held in {1}.' -f
    (Get-ChildItem -LiteralPath $BackupDirectory -Filter '*.dump' -File).Count,
    $BackupDirectory
  ) -ForegroundColor Yellow

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


# ------------------------------------------------------------
# 7. Local retention
#
# Last, and only once `check` has passed: until the off-host repository
# is verified readable there is nothing to fall back on, so a local
# dump deleted before this point could be the last copy.
# ------------------------------------------------------------

Write-Host `
  'Applying local backup retention policy...' `
  -ForegroundColor Cyan

Remove-StaleLocalTempFile

Remove-SupersededLocalBackup `
  -Keep (Get-LocalBackupKeepCount -Default 2) `
  -OffsiteDumpName (Get-OffsiteDumpName)


Write-Host `
  'PostgreSQL local + encrypted off-host backup completed successfully.' `
  -ForegroundColor Green
