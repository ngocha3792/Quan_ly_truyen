[CmdletBinding()]
param(
  [ValidateSet('Auto', 'Local', 'Registry')]
  [string]$DeploymentMode = 'Auto',

  [string]$EnvironmentFile = '.env.production',

  [switch]$SkipPull,
  [switch]$SkipObservability,
  [switch]$SkipPostdeployGate,
  [switch]$SkipImagePrune
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
$BuildComposeFile = Join-Path $BackendRoot 'compose.production.build.yml'

if (-not (Test-Path -LiteralPath $EnvironmentFilePath -PathType Leaf)) {
  throw "Deployment environment file is missing: $EnvironmentFilePath"
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
  -Path $EnvironmentFilePath `
  -Name 'BACKEND_IMAGE_NAME'

$BackendImageTag = Get-DotEnvValue `
  -Path $EnvironmentFilePath `
  -Name 'BACKEND_IMAGE_TAG'

$FrontendImageName = Get-DotEnvValue `
  -Path $EnvironmentFilePath `
  -Name 'FRONTEND_IMAGE_NAME'

$FrontendImageTag = Get-DotEnvValue `
  -Path $EnvironmentFilePath `
  -Name 'FRONTEND_IMAGE_TAG'

if ([string]::IsNullOrWhiteSpace($BackendImageName)) {
  throw "BACKEND_IMAGE_NAME is missing from $EnvironmentFilePath."
}

if ([string]::IsNullOrWhiteSpace($BackendImageTag)) {
  throw "BACKEND_IMAGE_TAG is missing from $EnvironmentFilePath."
}

if ([string]::IsNullOrWhiteSpace($FrontendImageName)) {
  throw "FRONTEND_IMAGE_NAME is missing from $EnvironmentFilePath."
}

if ([string]::IsNullOrWhiteSpace($FrontendImageTag)) {
  throw "FRONTEND_IMAGE_TAG is missing from $EnvironmentFilePath."
}

function Assert-ImmutableApplicationImageTag {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if ($Value -eq 'local') {
    return
  }

  if ($Value -notmatch '^[0-9a-fA-F]{40}$') {
    throw "$Name must be the full 40-character source Git SHA. Received: $Value"
  }
}

Assert-ImmutableApplicationImageTag `
  -Name 'BACKEND_IMAGE_TAG' `
  -Value $BackendImageTag

Assert-ImmutableApplicationImageTag `
  -Name 'FRONTEND_IMAGE_TAG' `
  -Value $FrontendImageTag

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

if (-not $UseLocalBuild -and
    ($BackendImageTag -eq 'local' -or $FrontendImageTag -eq 'local')) {
  throw "Registry deployment cannot use the 'local' image tag."
}

$Compose = @(
  'compose',
  '--env-file', $EnvironmentFilePath,
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

# Optional host-specific compose override (for example, binding api/frontend
# to loopback ports for a host-level Nginx edge instead of the caddy
# container). Applied whenever present so a fresh deploy never silently
# drops port bindings the edge proxy depends on.
$HostOverrideComposeFile = Join-Path $BackendRoot 'compose.vps.yml'

if (Test-Path -LiteralPath $HostOverrideComposeFile -PathType Leaf) {
  $Compose += @(
    '-f', 'compose.vps.yml'
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

function Invoke-DockerComposePull {
  param(
    [string[]]$Services = @(),

    [ValidateSet('always', 'missing')]
    [string]$Policy = 'missing',

    [ValidateRange(1, 10)]
    [int]$MaxAttempts = 4,

    [ValidateRange(1, 300)]
    [int]$BaseDelaySeconds = 10
  )

  $PullArguments = @('pull', '--policy', $Policy) + $Services

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt += 1) {
    & docker @Compose @PullArguments

    if ($LASTEXITCODE -eq 0) {
      return
    }

    if ($Attempt -eq $MaxAttempts) {
      throw (
        'docker compose failed after {0} attempts: {1}' -f `
          $MaxAttempts,
          ($PullArguments -join ' ')
      )
    }

    $DelaySeconds = [int](
      $BaseDelaySeconds * [Math]::Pow(2, $Attempt - 1)
    )

    Write-Warning (
      'docker compose pull attempt {0}/{1} failed; retrying in {2}s.' -f `
        $Attempt,
        $MaxAttempts,
        $DelaySeconds
    )

    Start-Sleep -Seconds $DelaySeconds
  }
}

$ObservabilityProjectName = Get-DotEnvValue `
  -Path $EnvironmentFilePath `
  -Name 'OBSERVABILITY_COMPOSE_PROJECT_NAME'

$ObservabilityCompose = @(
  'compose',
  '--env-file', $EnvironmentFilePath
)

if (-not [string]::IsNullOrWhiteSpace($ObservabilityProjectName)) {
  $ObservabilityCompose += @('--project-name', $ObservabilityProjectName)
}

$ObservabilityCompose += @('-f', 'ops/observability/docker-compose.observability.yml')

function Invoke-ObservabilityCompose {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & docker @ObservabilityCompose @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "docker compose observability failed: $($Arguments -join ' ')"
  }
}

Write-Host '[1/9] Validating Docker Compose configuration...' `
  -ForegroundColor Cyan

Invoke-DockerCompose -Arguments @('config', '--quiet')

if (-not $SkipObservability) {
  Invoke-ObservabilityCompose -Arguments @('config', '--quiet')
}

if ($SkipImagePrune) {
  Write-Host '[2/9] Image prune skipped.' -ForegroundColor Yellow
}
else {
  # Every deploy pulls or builds a fresh ~300MB+ image per service, and the
  # image it replaces becomes immediately unused (rollback re-pulls the
  # target SHA from the registry rather than relying on a local cache -- see
  # Invoke-Rollback.ps1 -> Deploy-Production.ps1 with SkipPull defaulting to
  # false). Left unpruned, this fills small production disks over repeated
  # deploys, so reclaim stale images before pulling the next one. The 24h
  # filter never touches the running image (still referenced) and leaves a
  # same-day window for manual recovery. A prune failure should not block
  # the deploy -- the pull step below will surface a clear disk error if
  # space genuinely ran out.
  Write-Host '[2/9] Pruning Docker images older than 24h to protect disk space...' `
    -ForegroundColor Cyan

  & docker image prune -af --filter 'until=24h' | Out-Null

  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'docker image prune failed; continuing deploy without freeing image disk space.'
  }
}

if ($UseLocalBuild) {
  Write-Host (
    "[3/9] Building local images: backend={0}:{1}, frontend={2}:{3}" `
      -f `
        $BackendImageName,
        $BackendImageTag,
        $FrontendImageName,
        $FrontendImageTag
  ) -ForegroundColor Cyan

  Invoke-DockerCompose build api migrate frontend

  if (-not $SkipPull) {
    Write-Host `
      '[3b/9] Pulling infrastructure images...' `
      -ForegroundColor Cyan

    Invoke-DockerComposePull `
      -Policy 'missing' `
      -Services @('postgres', 'redis')
  }
}
elseif (-not $SkipPull) {
  Write-Host (
    "[3/9] Pulling registry images: backend={0}:{1}, frontend={2}:{3}" `
      -f `
        $BackendImageName,
        $BackendImageTag,
        $FrontendImageName,
        $FrontendImageTag
  ) -ForegroundColor Cyan

  # Application images use immutable SHA tags, so a missing local tag still
  # has to be downloaded. Long-lived infrastructure images are already
  # referenced by running containers and should not make every application
  # release depend on Docker Hub being reachable again.
  Invoke-DockerComposePull -Policy 'missing'
}
else {
  Write-Host '[3/9] Image pull skipped.' -ForegroundColor Yellow
}

Write-Host '[4/9] Starting PostgreSQL and Redis...' `
  -ForegroundColor Cyan

Invoke-DockerCompose -Arguments @('up', '-d', '--wait', 'postgres', 'redis')

Write-Host '[5/9] Applying database migrations...' `
  -ForegroundColor Cyan

Invoke-DockerCompose up `
  --force-recreate `
  --abort-on-container-exit `
  --exit-code-from migrate `
  migrate

Write-Host '[6/9] Running predeploy production gate...' `
  -ForegroundColor Cyan

Invoke-DockerCompose --profile tools run --rm gate-predeploy

Write-Host '[7/9] Recording initial maintenance heartbeats...' `
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
  '[8/9] Starting API, worker, recovery metrics and frontend (HTTPS edge is a host-level Nginx reverse proxy, not managed by this script)...' `
  -ForegroundColor Cyan

Invoke-DockerCompose -Arguments @(
  'up',
  '-d',
  '--wait',
  'api',
  'worker',
  'recovery-metrics',
  'frontend'
)

$FrontendStaticDirectory = Get-DotEnvValue `
  -Path $EnvironmentFilePath `
  -Name 'FRONTEND_STATIC_DIRECTORY'

if (-not [string]::IsNullOrWhiteSpace($FrontendStaticDirectory)) {
  # Some hosts (this one included) terminate TLS and serve
  # content-hashed static assets (js/css) straight from disk via a
  # host-level Nginx edge, with the frontend container only handling
  # SSR and API proxying. Every asset filename changes hash on each
  # frontend build, so this directory must be refreshed on every
  # deploy or the previous build's hashed filenames start 404'ing
  # (and, since the SSR fallback route serves index.html for any
  # unmatched path, the browser gets HTML back for a <script
  # type="module"> request and refuses to run it -- pages stop
  # rendering with no visible error beyond the console).
  Write-Host `
    '[8c/9] Refreshing static frontend assets for the host-level edge proxy...' `
    -ForegroundColor Cyan

  $ResolvedStaticDirectory = if (
    [IO.Path]::IsPathRooted($FrontendStaticDirectory)
  ) {
    $FrontendStaticDirectory
  }
  else {
    Join-Path $BackendRoot $FrontendStaticDirectory
  }

  $StagingDirectory = "$ResolvedStaticDirectory.staging"
  $PreviousDirectory = "$ResolvedStaticDirectory.previous"

  if (Test-Path -LiteralPath $StagingDirectory) {
    Remove-Item -LiteralPath $StagingDirectory -Recurse -Force
  }

  New-Item -ItemType Directory -Path $StagingDirectory -Force | Out-Null

  $FrontendContainerId = (
    & docker compose --env-file $EnvironmentFilePath `
      -f compose.production.yml ps -q frontend
  ).Trim()

  if ([string]::IsNullOrWhiteSpace($FrontendContainerId)) {
    throw 'Could not resolve the frontend container to extract static assets from.'
  }

  & docker cp "${FrontendContainerId}:/app/dist/frontend/browser/." $StagingDirectory

  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to copy static frontend assets out of the frontend container.'
  }

  # `docker cp` and any transient temp directory can land with a
  # restrictive mode; the host-level Nginx worker runs as a different
  # user (www-data) than this deploy user, so every directory in the
  # tree must stay traversable and every file world-readable or Nginx
  # gets a silent permission failure indistinguishable from "missing".
  chmod 755 $StagingDirectory

  Get-ChildItem -LiteralPath $StagingDirectory -Recurse -Directory |
    ForEach-Object { chmod 755 $_.FullName }

  Get-ChildItem -LiteralPath $StagingDirectory -Recurse -File |
    ForEach-Object { chmod 644 $_.FullName }

  if (Test-Path -LiteralPath $PreviousDirectory) {
    Remove-Item -LiteralPath $PreviousDirectory -Recurse -Force
  }

  if (Test-Path -LiteralPath $ResolvedStaticDirectory) {
    Move-Item -LiteralPath $ResolvedStaticDirectory -Destination $PreviousDirectory
  }

  Move-Item -LiteralPath $StagingDirectory -Destination $ResolvedStaticDirectory

  Write-Host (
    "Static frontend assets refreshed at {0}." -f $ResolvedStaticDirectory
  ) -ForegroundColor Green
}

if (-not $SkipObservability) {
  Write-Host '[8b/9] Starting observability stack...' `
    -ForegroundColor Cyan

  Invoke-ObservabilityCompose -Arguments @('up', '-d')
}

if (-not $SkipPostdeployGate) {
  Write-Host '[9/9] Running postdeploy production gate...' `
    -ForegroundColor Cyan

  Invoke-DockerCompose --profile tools run --rm gate-postdeploy
}
else {
  Write-Host '[9/9] Postdeploy gate skipped.' `
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
