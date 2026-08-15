[CmdletBinding()]
param(
  [ValidateSet('staging', 'production')]
  [string]$EnvironmentName = 'production',

  [string]$EnvironmentFile,

  [string]$PublicUrl,

  [ValidateRange(1, 30)]
  [int]$Attempts = 10,

  [ValidateRange(1, 30)]
  [int]$DelaySeconds = 3,

  [ValidateRange(1, 60)]
  [int]$TimeoutSeconds = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Deployment.Common.ps1')

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvironmentFilePath = Get-DeploymentEnvironmentFilePath `
  -BackendRoot $BackendRoot `
  -EnvironmentName $EnvironmentName `
  -EnvironmentFile $EnvironmentFile

if (-not (Test-Path -LiteralPath $EnvironmentFilePath -PathType Leaf)) {
  throw "Deployment environment file is missing: $EnvironmentFilePath"
}

$ResolvedPublicUrl = if ([string]::IsNullOrWhiteSpace($PublicUrl)) {
  Get-DeploymentDotEnvValue -Path $EnvironmentFilePath -Name 'APP_PUBLIC_URL'
}
else {
  $PublicUrl
}

if ([string]::IsNullOrWhiteSpace($ResolvedPublicUrl)) {
  $Domain = Get-DeploymentDotEnvValue -Path $EnvironmentFilePath -Name 'APP_DOMAIN'

  if ([string]::IsNullOrWhiteSpace($Domain)) {
    throw 'APP_PUBLIC_URL or APP_DOMAIN is required for deployment smoke tests.'
  }

  $ResolvedPublicUrl = if ($Domain -match '^https?://') {
    $Domain
  }
  else {
    "https://$Domain"
  }
}

$ResolvedPublicUrl = $ResolvedPublicUrl.TrimEnd('/')

if ($EnvironmentName -eq 'production' -and $ResolvedPublicUrl -notmatch '^https://') {
  throw "Production smoke tests require HTTPS. Received: $ResolvedPublicUrl"
}

$Checks = @(
  @{ Name = 'frontend health'; Path = '/health' },
  @{ Name = 'API liveness'; Path = '/api/v1/health/live' },
  @{ Name = 'API readiness'; Path = '/api/v1/health/ready' },
  @{ Name = 'robots'; Path = '/robots.txt' }
)

foreach ($Check in $Checks) {
  $Uri = $ResolvedPublicUrl + $Check.Path
  $Succeeded = $false
  $LastError = $null

  for ($Attempt = 1; $Attempt -le $Attempts; $Attempt++) {
    try {
      $Response = Invoke-WebRequest `
        -Uri $Uri `
        -Method Get `
        -TimeoutSec $TimeoutSeconds `
        -MaximumRedirection 5 `
        -UseBasicParsing

      if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400) {
        Write-Host (
          '[smoke] {0}: HTTP {1} ({2})' -f `
            $Check.Name,
            $Response.StatusCode,
            $Uri
        ) -ForegroundColor Green

        $Succeeded = $true
        break
      }

      $LastError = "Unexpected HTTP status: $($Response.StatusCode)"
    }
    catch {
      $LastError = $_.Exception.Message
    }

    if ($Attempt -lt $Attempts) {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  if (-not $Succeeded) {
    throw "Deployment smoke test failed for $($Check.Name) ($Uri): $LastError"
  }
}

Write-Host (
  "Deployment smoke tests passed for $EnvironmentName at $ResolvedPublicUrl."
) -ForegroundColor Green
