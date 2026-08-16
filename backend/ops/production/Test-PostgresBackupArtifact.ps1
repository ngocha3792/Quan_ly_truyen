[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [string]$EnvironmentFile = '.env.production',

  [ValidateRange(1, 87600)]
  [int]$MaxAgeHours = 48,

  [long]$MinimumBytes = 4096,

  [switch]$SkipAgeCheck
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

if ($MinimumBytes -lt 1) {
  throw 'MinimumBytes must be greater than zero.'
}

$ResolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$Backup = Get-Item -LiteralPath $ResolvedBackup
$ChecksumFile = "$ResolvedBackup.sha256"

if (-not (Test-Path -LiteralPath $ChecksumFile -PathType Leaf)) {
  throw "Backup checksum is missing: $ChecksumFile"
}

if ($Backup.Length -lt $MinimumBytes) {
  throw "Backup is unexpectedly small: $($Backup.Length) bytes"
}

$Age = [DateTime]::UtcNow - $Backup.LastWriteTimeUtc

if (-not $SkipAgeCheck -and $Age.TotalHours -gt $MaxAgeHours) {
  throw (
    'Backup is older than the allowed age. AgeHours={0:N2} MaxAgeHours={1}' -f `
      $Age.TotalHours, `
      $MaxAgeHours
  )
}

$ChecksumLine = Get-Content -LiteralPath $ChecksumFile -TotalCount 1
$ExpectedHash = ($ChecksumLine -split '\s+', 2)[0].Trim().ToLowerInvariant()

if ($ExpectedHash -notmatch '^[a-f0-9]{64}$') {
  throw 'Backup checksum file does not contain a valid SHA-256 digest.'
}

$ActualHash = (
  Get-FileHash -LiteralPath $ResolvedBackup -Algorithm SHA256
).Hash.ToLowerInvariant()

if ($ActualHash -cne $ExpectedHash) {
  throw "Backup SHA-256 mismatch. Expected=$ExpectedHash Actual=$ActualHash"
}

$ContainerBackupPath = '/verify/backup.dump'
$Mount = "${ResolvedBackup}:${ContainerBackupPath}:ro"

& docker compose `
  --env-file $EnvironmentFilePath `
  -f compose.production.yml `
  --profile maintenance `
  run `
  --rm `
  --no-deps `
  --volume $Mount `
  --entrypoint pg_restore `
  backup-postgres `
  --list `
  $ContainerBackupPath |
Out-Null

if ($LASTEXITCODE -ne 0) {
  throw 'pg_restore could not read the backup archive.'
}

[pscustomobject]@{
  BackupFile = $ResolvedBackup
  SizeBytes = $Backup.Length
  Sha256 = $ActualHash
  LastWriteTimeUtc = $Backup.LastWriteTimeUtc.ToString('o')
  AgeHours = [Math]::Round($Age.TotalHours, 3)
}
