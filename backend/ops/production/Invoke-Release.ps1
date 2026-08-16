[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('staging', 'production')]
  [string]$EnvironmentName,

  [Parameter(Mandatory = $true)]
  [string]$SourceSha,

  [ValidateSet('Auto', 'Local', 'Registry')]
  [string]$DeploymentMode = 'Registry',

  [string]$EnvironmentFile,

  [string]$StateDirectory,

  [switch]$SkipPull,
  [switch]$SkipObservability,
  [switch]$SkipPostdeployGate,
  [switch]$SkipSmoke,
  [switch]$SkipProductionBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Deployment.Common.ps1')

Assert-DeploymentSourceSha -Value $SourceSha
$SourceSha = $SourceSha.ToLowerInvariant()

if ($EnvironmentName -eq 'production' -and $DeploymentMode -ne 'Registry') {
  throw 'Production releases must use Registry deployment mode with immutable images.'
}

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

$EnvironmentFilePath = Get-DeploymentEnvironmentFilePath `
  -BackendRoot $BackendRoot `
  -EnvironmentName $EnvironmentName `
  -EnvironmentFile $EnvironmentFile

if (-not (Test-Path -LiteralPath $EnvironmentFilePath -PathType Leaf)) {
  throw "Deployment environment file is missing: $EnvironmentFilePath"
}

$ComposeProjectName = Get-DeploymentDotEnvValue `
  -Path $EnvironmentFilePath `
  -Name 'COMPOSE_PROJECT_NAME'

if ($EnvironmentName -eq 'staging' -and
    ([string]::IsNullOrWhiteSpace($ComposeProjectName) -or
     $ComposeProjectName -eq 'quan-ly-truyen-production')) {
  throw 'Staging must set a dedicated COMPOSE_PROJECT_NAME (for example quan-ly-truyen-staging).'
}

$ResolvedStateDirectory = Get-DeploymentStateDirectory `
  -BackendRoot $BackendRoot `
  -EnvironmentName $EnvironmentName `
  -StateDirectory $StateDirectory

$Lock = Enter-DeploymentLock -StateDirectory $ResolvedStateDirectory
$BackendTagBefore = $null
$FrontendTagBefore = $null

try {
  $BackendTagBefore = Get-DeploymentDotEnvValue `
    -Path $EnvironmentFilePath `
    -Name 'BACKEND_IMAGE_TAG'

  $FrontendTagBefore = Get-DeploymentDotEnvValue `
    -Path $EnvironmentFilePath `
    -Name 'FRONTEND_IMAGE_TAG'

  $PublicUrl = Get-DeploymentDotEnvValue `
    -Path $EnvironmentFilePath `
    -Name 'APP_PUBLIC_URL'

  $PreviousSuccessful = Read-DeploymentJson `
    -Path (Join-Path $ResolvedStateDirectory 'current.json')

  $PreviousSourceSha = if ($null -ne $PreviousSuccessful) {
    [string]$PreviousSuccessful.sourceSha
  }
  elseif ($BackendTagBefore -match '^[0-9a-fA-F]{40}$' -and
          $FrontendTagBefore -eq $BackendTagBefore) {
    $BackendTagBefore.ToLowerInvariant()
  }
  else {
    $null
  }

  if ($EnvironmentName -eq 'production' -and
      $PreviousSourceSha -and
      -not $SkipProductionBackup) {
    Write-Host '[release] Creating verified pre-deploy backup...' -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot 'Backup-Postgres.ps1') -EnvironmentFile $EnvironmentFilePath

    if ($LASTEXITCODE -ne 0) {
      throw 'Pre-deploy PostgreSQL backup failed.'
    }

    & (Join-Path $PSScriptRoot 'Test-RecoveryReadiness.ps1') -EnvironmentFile $EnvironmentFilePath

    if ($LASTEXITCODE -ne 0) {
      throw 'Recovery readiness gate failed before production deploy.'
    }
  }

  if ($null -ne $PreviousSuccessful) {
    Write-DeploymentJsonAtomic `
      -Path (Join-Path $ResolvedStateDirectory 'previous.json') `
      -Value $PreviousSuccessful
  }
  elseif ($PreviousSourceSha) {
    $SyntheticPrevious = New-DeploymentRecord `
      -Operation release `
      -EnvironmentName $EnvironmentName `
      -SourceSha $PreviousSourceSha `
      -DeploymentMode $DeploymentMode `
      -PublicUrl $PublicUrl

    Write-DeploymentJsonAtomic `
      -Path (Join-Path $ResolvedStateDirectory 'previous.json') `
      -Value $SyntheticPrevious
  }

  Set-DeploymentDotEnvValues `
    -Path $EnvironmentFilePath `
    -Values @{
      BACKEND_IMAGE_TAG = $SourceSha
      FRONTEND_IMAGE_TAG = $SourceSha
      DEPLOYMENT_ENVIRONMENT = $EnvironmentName
      RELEASE_SHA = $SourceSha
    }

  Write-Host (
    '[release] Deploying {0} at source SHA {1}...' -f `
      $EnvironmentName,
      $SourceSha
  ) -ForegroundColor Cyan

  $DeployArguments = @{
    DeploymentMode = $DeploymentMode
    EnvironmentFile = $EnvironmentFilePath
    SkipPull = $SkipPull
    SkipObservability = $SkipObservability
    SkipPostdeployGate = $SkipPostdeployGate
  }

  & (Join-Path $PSScriptRoot 'Deploy-Production.ps1') @DeployArguments

  if ($LASTEXITCODE -ne 0) {
    throw 'Deployment script failed.'
  }

  if (-not $SkipSmoke) {
    & (Join-Path $PSScriptRoot 'Test-DeploymentSmoke.ps1') `
      -EnvironmentName $EnvironmentName `
      -EnvironmentFile $EnvironmentFilePath

    if ($LASTEXITCODE -ne 0) {
      throw 'External deployment smoke tests failed.'
    }
  }

  $Record = New-DeploymentRecord `
    -Operation release `
    -EnvironmentName $EnvironmentName `
    -SourceSha $SourceSha `
    -PreviousSourceSha $PreviousSourceSha `
    -DeploymentMode $DeploymentMode `
    -PublicUrl $PublicUrl

  Write-DeploymentJsonAtomic `
    -Path (Join-Path $ResolvedStateDirectory 'current.json') `
    -Value $Record

  Save-DeploymentHistoryRecord `
    -StateDirectory $ResolvedStateDirectory `
    -Record $Record

  Write-Host (
    '[release] {0} now runs {1}.' -f $EnvironmentName, $SourceSha
  ) -ForegroundColor Green
}
catch {
  if ($BackendTagBefore -and $FrontendTagBefore) {
    Set-DeploymentDotEnvValues `
      -Path $EnvironmentFilePath `
      -Values @{
        BACKEND_IMAGE_TAG = $BackendTagBefore
        FRONTEND_IMAGE_TAG = $FrontendTagBefore
        RELEASE_SHA = $BackendTagBefore
      }
  }

  $Failure = [pscustomobject]@{
    schemaVersion = 1
    environment = $EnvironmentName
    attemptedSourceSha = $SourceSha
    previousBackendImageTag = $BackendTagBefore
    previousFrontendImageTag = $FrontendTagBefore
    failedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
    message = $_.Exception.Message
  }

  Write-DeploymentJsonAtomic `
    -Path (Join-Path $ResolvedStateDirectory 'last-failure.json') `
    -Value $Failure

  Write-Warning 'The environment file was restored, but containers may be partially updated.'
  Write-Warning 'Inspect docker compose state before retrying or invoking rollback.'
  throw
}
finally {
  $Lock.Dispose()
}
