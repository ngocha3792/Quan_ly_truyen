[CmdletBinding()]
param(
  [ValidateSet('Auto', 'Local', 'Registry')]
  [string]$DeploymentMode = 'Auto',

  [switch]$SkipPull,
  [switch]$SkipObservability,
  [switch]$SkipPostdeployGate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendRoot

$EnvironmentFile = Join-Path $BackendRoot '.env.production'
$BuildComposeFile = Join-Path $BackendRoot 'compose.production.build.yml'

if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
  throw '.env.production is missing. Run ops/production/New-ProductionEnv.ps1 first.'
}

function Get-DotEnvValue {
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

$BackendImageName = Get-DotEnvValue `
  -Path $EnvironmentFile `
  -Name 'BACKEND_IMAGE_NAME'

$BackendImageTag = Get-DotEnvValue `
  -Path $EnvironmentFile `
  -Name 'BACKEND_IMAGE_TAG'

$FrontendImageName = Get-DotEnvValue `
  -Path $EnvironmentFile `
  -Name 'FRONTEND_IMAGE_NAME'

$FrontendImageTag = Get-DotEnvValue `
  -Path $EnvironmentFile `
  -Name 'FRONTEND_IMAGE_TAG'

if ([string]::IsNullOrWhiteSpace($BackendImageName)) {
  throw 'BACKEND_IMAGE_NAME is missing from .env.production.'
}

if ([string]::IsNullOrWhiteSpace($BackendImageTag)) {
  throw 'BACKEND_IMAGE_TAG is missing from .env.production.'
}

if ([string]::IsNullOrWhiteSpace($FrontendImageName)) {
  throw 'FRONTEND_IMAGE_NAME is missing from .env.production.'
}

if ([string]::IsNullOrWhiteSpace($FrontendImageTag)) {
  throw 'FRONTEND_IMAGE_TAG is missing from .env.production.'
}

$UseLocalBuild = switch ($DeploymentMode) {
  'Local' {
    $true
  }

  'Registry' {
    $false
  }

  default {
    $BackendImageTag -eq 'local' -or
    $FrontendImageTag -eq 'local' -or
    $BackendImageName -notmatch '^[a-z0-9.-]+\.[a-z]{2,}/' -or
    $FrontendImageName -notmatch '^[a-z0-9.-]+\.[a-z]{2,}/'
  }
}

$Compose = @(
  'compose',
  '--env-file', '.env.production',
  '-f', 'compose.production.yml'
)

if ($UseLocalBuild) {
  if (-not (Test-Path -LiteralPath $BuildComposeFile -PathType Leaf)) {
    throw 'compose.production.build.yml is missing.'
  }

  $Compose += @(
    '-f', 'compose.production.build.yml'
  )
}

function Invoke-DockerCompose {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & docker @Compose @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed: $($Arguments -join ' ')"
  }
}

Write-Host '[1/8] Validating Docker Compose configuration...' `
  -ForegroundColor Cyan

Invoke-DockerCompose config --quiet

if ($UseLocalBuild) {
  Write-Host (
    "[2/8] Building local images: backend={0}:{1}, frontend={2}:{3}" `
      -f `
        $BackendImageName,
        $BackendImageTag,
        $FrontendImageName,
        $FrontendImageTag
  ) -ForegroundColor Cyan

  Invoke-DockerCompose build api migrate frontend

  if (-not $SkipPull) {
    Write-Host `
      '[2b/8] Pulling infrastructure images...' `
      -ForegroundColor Cyan

    Invoke-DockerCompose pull postgres redis caddy
  }
}
elseif (-not $SkipPull) {
  Write-Host (
    "[2/8] Pulling registry images: backend={0}:{1}, frontend={2}:{3}" `
      -f `
        $BackendImageName,
        $BackendImageTag,
        $FrontendImageName,
        $FrontendImageTag
  ) -ForegroundColor Cyan

  Invoke-DockerCompose pull
}
else {
  Write-Host '[2/8] Image pull skipped.' -ForegroundColor Yellow
}

Write-Host '[3/8] Starting PostgreSQL and Redis...' `
  -ForegroundColor Cyan

Invoke-DockerCompose up -d --wait postgres redis

Write-Host '[4/8] Applying database migrations...' `
  -ForegroundColor Cyan

Invoke-DockerCompose up `
  --force-recreate `
  --abort-on-container-exit `
  --exit-code-from migrate `
  migrate

Write-Host '[5/8] Running predeploy production gate...' `
  -ForegroundColor Cyan

Invoke-DockerCompose --profile tools run --rm gate-predeploy

Write-Host '[6/8] Recording initial maintenance heartbeats...' `
  -ForegroundColor Cyan

foreach (
  $Service in @(
    'auth-cleanup',
    'outbox-cleanup',
    'mail-queue-cleanup'
  )
) {
  Invoke-DockerCompose --profile maintenance run --rm $Service
}

Write-Host `
  '[7/8] Starting API, worker, frontend and HTTPS edge...' `
  -ForegroundColor Cyan

Invoke-DockerCompose up `
  -d `
  --wait `
  api `
  worker `
  frontend `
  caddy

if (-not $SkipObservability) {
  Write-Host '[7b/8] Starting observability stack...' `
    -ForegroundColor Cyan

  & docker compose `
    --env-file .env.production `
    -f ops/observability/docker-compose.observability.yml `
    up -d

  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to start the observability stack.'
  }
}

if (-not $SkipPostdeployGate) {
  Write-Host '[8/8] Running postdeploy production gate...' `
    -ForegroundColor Cyan

  Invoke-DockerCompose --profile tools run --rm gate-postdeploy
}
else {
  Write-Host '[8/8] Postdeploy gate skipped.' `
    -ForegroundColor Yellow
}

Invoke-DockerCompose -Arguments @("ps", "-a")

$CompletedMode = if ($UseLocalBuild) {
  'LOCAL BUILD'
}
else {
  'REGISTRY'
}

Write-Host ("Deployment completed in {0} mode." -f $CompletedMode) -ForegroundColor Green