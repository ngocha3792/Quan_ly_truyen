Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-DeploymentDotEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $Line = Get-Content -LiteralPath $Path |
    Where-Object {
      $_ -match "^\s*$([regex]::Escape($Name))\s*="
    } |
    Select-Object -Last 1

  if ($null -eq $Line) {
    return $null
  }

  $Value = ($Line -split '=', 2)[1].Trim()

  if (
    ($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
    ($Value.StartsWith("'") -and $Value.EndsWith("'"))
  ) {
    $Value = $Value.Substring(1, $Value.Length - 2)
  }

  return $Value
}

function Assert-DeploymentSourceSha {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value,

    [string]$Name = 'SourceSha'
  )

  if ($Value -notmatch '^[0-9a-fA-F]{40}$') {
    throw "$Name must be a full 40-character Git SHA. Received: $Value"
  }
}

function Set-DeploymentDotEnvValues {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [hashtable]$Values
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Environment file does not exist: $Path"
  }

  $Lines = [Collections.Generic.List[string]]::new()

  foreach ($Line in Get-Content -LiteralPath $Path) {
    $Lines.Add($Line)
  }

  foreach ($Name in $Values.Keys) {
    $Replacement = "$Name=$($Values[$Name])"
    $Pattern = "^\s*$([regex]::Escape([string]$Name))\s*="
    $Found = $false

    for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
      if ($Lines[$Index] -match $Pattern) {
        $Lines[$Index] = $Replacement
        $Found = $true
      }
    }

    if (-not $Found) {
      $Lines.Add($Replacement)
    }
  }

  $Directory = Split-Path -Parent $Path
  $TemporaryPath = Join-Path $Directory ('.env.deploy.' + [guid]::NewGuid().ToString('N') + '.tmp')

  try {
    $Utf8WithoutBom = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllLines($TemporaryPath, $Lines, $Utf8WithoutBom)
    Move-Item -LiteralPath $TemporaryPath -Destination $Path -Force
  }
  finally {
    if (Test-Path -LiteralPath $TemporaryPath) {
      Remove-Item -LiteralPath $TemporaryPath -Force
    }
  }
}

function Get-DeploymentEnvironmentFilePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BackendRoot,

    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$EnvironmentName,

    [string]$EnvironmentFile
  )

  $ResolvedFile = if ([string]::IsNullOrWhiteSpace($EnvironmentFile)) {
    if ($EnvironmentName -eq 'production') {
      '.env.production'
    }
    else {
      '.env.staging'
    }
  }
  else {
    $EnvironmentFile
  }

  if ([IO.Path]::IsPathRooted($ResolvedFile)) {
    return $ResolvedFile
  }

  return Join-Path $BackendRoot $ResolvedFile
}

function Get-DeploymentStateDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BackendRoot,

    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$EnvironmentName,

    [string]$StateDirectory
  )

  $ResolvedDirectory = if ([string]::IsNullOrWhiteSpace($StateDirectory)) {
    Join-Path $BackendRoot "ops/production/.deployment-state/$EnvironmentName"
  }
  elseif ([IO.Path]::IsPathRooted($StateDirectory)) {
    $StateDirectory
  }
  else {
    Join-Path $BackendRoot $StateDirectory
  }

  New-Item -ItemType Directory -Path $ResolvedDirectory -Force | Out-Null
  return $ResolvedDirectory
}

function Write-DeploymentJsonAtomic {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [object]$Value
  )

  $Directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $Directory -Force | Out-Null

  $TemporaryPath = Join-Path $Directory ((Split-Path -Leaf $Path) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')

  try {
    $Json = $Value | ConvertTo-Json -Depth 8
    $Utf8WithoutBom = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($TemporaryPath, $Json + [Environment]::NewLine, $Utf8WithoutBom)
    Move-Item -LiteralPath $TemporaryPath -Destination $Path -Force
  }
  finally {
    if (Test-Path -LiteralPath $TemporaryPath) {
      Remove-Item -LiteralPath $TemporaryPath -Force
    }
  }
}

function Read-DeploymentJson {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Enter-DeploymentLock {
  param([Parameter(Mandatory = $true)][string]$StateDirectory)

  $Path = Join-Path $StateDirectory 'deployment.lock'

  try {
    return [IO.File]::Open(
      $Path,
      [IO.FileMode]::OpenOrCreate,
      [IO.FileAccess]::ReadWrite,
      [IO.FileShare]::None
    )
  }
  catch {
    throw "Another deployment or rollback is already running. Lock: $Path"
  }
}

function New-DeploymentRecord {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('release', 'rollback')]
    [string]$Operation,

    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$EnvironmentName,

    [Parameter(Mandatory = $true)]
    [string]$SourceSha,

    [string]$PreviousSourceSha,

    [Parameter(Mandatory = $true)]
    [string]$DeploymentMode,

    [string]$PublicUrl
  )

  [pscustomobject]@{
    schemaVersion = 1
    operation = $Operation
    environment = $EnvironmentName
    sourceSha = $SourceSha.ToLowerInvariant()
    previousSourceSha = if ($PreviousSourceSha) { $PreviousSourceSha.ToLowerInvariant() } else { $null }
    deploymentMode = $DeploymentMode
    publicUrl = $PublicUrl
    completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
  }
}

function Save-DeploymentHistoryRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StateDirectory,

    [Parameter(Mandatory = $true)]
    [object]$Record
  )

  $HistoryDirectory = Join-Path $StateDirectory 'history'
  New-Item -ItemType Directory -Path $HistoryDirectory -Force | Out-Null

  $Timestamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
  $SourceSha = [string]$Record.sourceSha
  $Operation = [string]$Record.operation
  $Path = Join-Path $HistoryDirectory "$Timestamp-$Operation-$SourceSha.json"

  Write-DeploymentJsonAtomic -Path $Path -Value $Record
}
