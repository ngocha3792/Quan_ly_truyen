[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('staging', 'production')]
  [string]$EnvironmentName,

  [string]$TargetSha,

  [string]$EnvironmentFile,

  [string]$StateDirectory,

  [switch]$ConfirmDatabaseIsBackwardCompatible,
  [switch]$SkipPull,
  [switch]$SkipObservability,
  [switch]$SkipPostdeployGate,
  [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Deployment.Common.ps1')

if ($EnvironmentName -eq 'production' -and
    -not $ConfirmDatabaseIsBackwardCompatible) {
  throw @'
Production application rollback does not roll back database schema/data.
Re-run with -ConfirmDatabaseIsBackwardCompatible only after confirming the
current database is backward-compatible with the target application SHA.
Use Restore-Postgres.ps1 separately when a database restore is required.
'@
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
  $Current = Read-DeploymentJson `
    -Path (Join-Path $ResolvedStateDirectory 'current.json')

  $Previous = Read-DeploymentJson `
    -Path (Join-Path $ResolvedStateDirectory 'previous.json')

  $ResolvedTargetSha = if ([string]::IsNullOrWhiteSpace($TargetSha)) {
    if ($null -eq $Previous) {
      throw 'No previous successful deployment is recorded. Pass -TargetSha explicitly.'
    }

    [string]$Previous.sourceSha
  }
  else {
    $TargetSha
  }

  Assert-DeploymentSourceSha -Value $ResolvedTargetSha -Name 'TargetSha'
  $ResolvedTargetSha = $ResolvedTargetSha.ToLowerInvariant()

  $CurrentSourceSha = if ($null -ne $Current) {
    [string]$Current.sourceSha
  }
  else {
    Get-DeploymentDotEnvValue -Path $EnvironmentFilePath -Name 'BACKEND_IMAGE_TAG'
  }

  if ($CurrentSourceSha -eq $ResolvedTargetSha) {
    throw "Target SHA $ResolvedTargetSha is already the active release."
  }

  $BackendTagBefore = Get-DeploymentDotEnvValue `
    -Path $EnvironmentFilePath `
    -Name 'BACKEND_IMAGE_TAG'

  $FrontendTagBefore = Get-DeploymentDotEnvValue `
    -Path $EnvironmentFilePath `
    -Name 'FRONTEND_IMAGE_TAG'

  $PublicUrl = Get-DeploymentDotEnvValue `
    -Path $EnvironmentFilePath `
    -Name 'APP_PUBLIC_URL'

  if ($EnvironmentName -eq 'production') {
    Write-Host '[rollback] Creating safety backup before application rollback...' -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot 'Backup-Postgres.ps1')

    if ($LASTEXITCODE -ne 0) {
      throw 'Safety backup failed; rollback aborted.'
    }
  }

  Set-DeploymentDotEnvValues `
    -Path $EnvironmentFilePath `
    -Values @{
      BACKEND_IMAGE_TAG = $ResolvedTargetSha
      FRONTEND_IMAGE_TAG = $ResolvedTargetSha
      DEPLOYMENT_ENVIRONMENT = $EnvironmentName
      RELEASE_SHA = $ResolvedTargetSha
    }

  Write-Host (
    '[rollback] Rolling {0} back from {1} to {2}...' -f `
      $EnvironmentName,
      $CurrentSourceSha,
      $ResolvedTargetSha
  ) -ForegroundColor Yellow

  & (Join-Path $PSScriptRoot 'Deploy-Production.ps1') `
    -DeploymentMode Registry `
    -EnvironmentFile $EnvironmentFilePath `
    -SkipPull:$SkipPull `
    -SkipObservability:$SkipObservability `
    -SkipPostdeployGate:$SkipPostdeployGate

  if ($LASTEXITCODE -ne 0) {
    throw 'Rollback deployment failed.'
  }

  if (-not $SkipSmoke) {
    & (Join-Path $PSScriptRoot 'Test-DeploymentSmoke.ps1') `
      -EnvironmentName $EnvironmentName `
      -EnvironmentFile $EnvironmentFilePath

    if ($LASTEXITCODE -ne 0) {
      throw 'Rollback smoke tests failed.'
    }
  }

  if ($null -ne $Current) {
    Write-DeploymentJsonAtomic `
      -Path (Join-Path $ResolvedStateDirectory 'previous.json') `
      -Value $Current
  }

  $Record = New-DeploymentRecord `
    -Operation rollback `
    -EnvironmentName $EnvironmentName `
    -SourceSha $ResolvedTargetSha `
    -PreviousSourceSha $CurrentSourceSha `
    -DeploymentMode Registry `
    -PublicUrl $PublicUrl

  Write-DeploymentJsonAtomic `
    -Path (Join-Path $ResolvedStateDirectory 'current.json') `
    -Value $Record

  Save-DeploymentHistoryRecord `
    -StateDirectory $ResolvedStateDirectory `
    -Record $Record

  Write-Host (
    '[rollback] {0} now runs {1}.' -f $EnvironmentName, $ResolvedTargetSha
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

  throw
}
finally {
  $Lock.Dispose()
}
