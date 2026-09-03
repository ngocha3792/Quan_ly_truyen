[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingPlainTextForPassword', 'SmtpPassword')]
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9.-]+$')]
  [string]$PublicDomain,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')]
  [string]$AcmeEmail,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')]
  [string]$MailFromAddress,

  [Parameter(Mandatory = $true)]
  [string]$SmtpHost,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int]$SmtpPort,

  [Parameter(Mandatory = $true)]
  [string]$SmtpUsername,

  [Parameter(Mandatory = $true)]
  [string]$SmtpPassword,

  [Parameter(Mandatory = $true)]
  [string]$BackendImageName,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9._-]+$')]
  [string]$BackendImageTag,

  [Parameter(Mandatory = $true)]
  [string]$FrontendImageName,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9._-]+$')]
  [string]$FrontendImageTag,

  [Parameter(Mandatory = $true)]
  [string]$ResticImage,

  [Parameter(Mandatory = $true)]
  [string]$AlertmanagerImage,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[^\s]+$')]
  [string]$AlertWebhookUrl,

  [Parameter(Mandatory = $true)]
  [string]$ResticRepository,

  [Parameter(Mandatory = $true)]
  [string]$BackupS3AccessKeyId,

  [Parameter(Mandatory = $true)]
  [string]$BackupS3SecretAccessKey,

  [string]$BackupS3Region = 'auto',

  [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]*$')]
  [string]$PostgresDatabase = 'quan_ly_truyen',
  [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]*$')]
  [string]$PostgresUser = 'qlt',
  [string]$MailFromName = 'Quan Ly Truyen',
  [string]$MailReplyTo,
  [switch]$SmtpSecure,
  [switch]$EnableDkim,
  [string]$DkimDomain,
  [string]$DkimSelector,
  [string]$DkimPrivateKeyPath,

  [ValidateSet('production', 'staging')]
  [string]$EnvironmentName = 'production',

  [string]$OutputFile,

  [string]$ComposeProjectName,

  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ResolvedOutputFile = if ([string]::IsNullOrWhiteSpace($OutputFile)) {
  if ($EnvironmentName -eq 'production') { '.env.production' } else { '.env.staging' }
}
else {
  $OutputFile
}
$OutputPath = if ([IO.Path]::IsPathRooted($ResolvedOutputFile)) {
  $ResolvedOutputFile
}
else {
  Join-Path $BackendRoot $ResolvedOutputFile
}
$ResolvedComposeProjectName = if ([string]::IsNullOrWhiteSpace($ComposeProjectName)) {
  "quan-ly-truyen-$EnvironmentName"
}
else {
  $ComposeProjectName
}
$ComposeEnvironmentFile = if ([IO.Path]::IsPathRooted($ResolvedOutputFile)) {
  $OutputPath
}
else {
  $ResolvedOutputFile
}
$SecretsDirectory = Join-Path $PSScriptRoot 'secrets'
$MetricsTokenFile = Join-Path $SecretsDirectory 'metrics_bearer_token'

if ((Test-Path -LiteralPath $OutputPath) -and -not $Force) {
  throw "$OutputPath already exists. Use -Force to overwrite it."
}

function Assert-ApplicationImageTag {
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
    throw "$Name must be a full 40-character Git SHA or 'local'. Received: $Value"
  }
}

function Assert-PinnedContainerImage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if ($Value -notmatch '(@sha256:[0-9a-fA-F]{64}|:[^/:]+)$' -or
    $Value -match ':latest$') {
    throw "$Name must use an explicit non-latest tag or sha256 digest. Received: $Value"
  }
}

Assert-ApplicationImageTag -Name 'BackendImageTag' -Value $BackendImageTag
Assert-ApplicationImageTag -Name 'FrontendImageTag' -Value $FrontendImageTag
Assert-PinnedContainerImage -Name 'ResticImage' -Value $ResticImage
Assert-PinnedContainerImage -Name 'AlertmanagerImage' -Value $AlertmanagerImage

if ($EnableDkim) {
  if ([string]::IsNullOrWhiteSpace($DkimDomain) -or
    [string]::IsNullOrWhiteSpace($DkimSelector) -or
    [string]::IsNullOrWhiteSpace($DkimPrivateKeyPath)) {
    throw 'DkimDomain, DkimSelector and DkimPrivateKeyPath are required with -EnableDkim.'
  }

  if (-not (Test-Path -LiteralPath $DkimPrivateKeyPath -PathType Leaf)) {
    throw "DKIM private key not found: $DkimPrivateKeyPath"
  }
}

function New-RandomBytes {
  param([Parameter(Mandatory = $true)][int]$Count)

  $bytes = New-Object byte[] $Count
  $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $Generator.GetBytes($bytes)
  }
  finally {
    $Generator.Dispose()
  }

  return $bytes
}

function New-UrlSafeSecret {
  param([int]$Bytes = 48)

  return [Convert]::ToBase64String((New-RandomBytes -Count $Bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Assert-SingleLineValue {
  param([AllowEmptyString()][string]$Value)

  if ($Value -match '[\r\n]') {
    throw 'Environment values cannot contain line breaks.'
  }

  return $Value
}

function Get-QuotedEnvValue {
  param([AllowEmptyString()][string]$Value)

  $Checked = Assert-SingleLineValue -Value $Value
  return "'" + $Checked.Replace("'", "\'") + "'"
}

$PostgresPassword = New-UrlSafeSecret
$RedisPassword = New-UrlSafeSecret
$JwtAccessSecret = New-UrlSafeSecret -Bytes 64
$JwtRefreshSecret = New-UrlSafeSecret -Bytes 64
$CsrfSecret = New-UrlSafeSecret -Bytes 64
$MetricsToken = New-UrlSafeSecret -Bytes 48
$GrafanaPassword = New-UrlSafeSecret -Bytes 36
$MaintenanceBypassToken = New-UrlSafeSecret -Bytes 36
$MailEncryptionKey = [Convert]::ToBase64String((New-RandomBytes -Count 32))
$MfaEncryptionKey = [Convert]::ToBase64String((New-RandomBytes -Count 32))
$ResticRepositoryPassword = New-UrlSafeSecret -Bytes 64
$RestoreDrillPostgresPassword = New-UrlSafeSecret -Bytes 48
$ResticPasswordFile = Join-Path $SecretsDirectory 'restic_repository_password'
$AlertWebhookFile = Join-Path $SecretsDirectory 'alert_webhook_url'

$EncodedPostgresPassword = [Uri]::EscapeDataString($PostgresPassword)
$EncodedRedisPassword = [Uri]::EscapeDataString($RedisPassword)
$MailDomain = $MailFromAddress.Split('@')[-1].ToLowerInvariant()
$ReplyTo = if ($MailReplyTo) { $MailReplyTo } else { $MailFromAddress }
$SmtpSecureValue = if ($SmtpSecure -or $SmtpPort -eq 465) { 'true' } else { 'false' }
$SmtpRequireTlsValue = if ($SmtpPort -eq 465) { 'false' } else { 'true' }
$DkimEnabledValue = if ($EnableDkim) { 'true' } else { 'false' }
$DkimKeyBase64 = if ($EnableDkim) {
  [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $DkimPrivateKeyPath)))
}
$ResolvedObservabilityProjectName = "${ResolvedComposeProjectName}-observability"
$ResolvedObservabilityBackendNetwork = "${ResolvedComposeProjectName}-backend"

if ($EnvironmentName -eq 'production') {
  $AlertmanagerHostPort = 9093
  $PrometheusHostPort = 9090
  $LokiHostPort = 3100
  $TempoHostPort = 3200
  $AlloyHostPort = 12345
  $GrafanaHostPort = 3001
}
else {
  $AlertmanagerHostPort = 19093
  $PrometheusHostPort = 19090
  $LokiHostPort = 13100
  $TempoHostPort = 13200
  $AlloyHostPort = 22345
  $GrafanaHostPort = 13001
}

$Content = @"
PRODUCTION_ENV_FILE=$(Get-QuotedEnvValue $ComposeEnvironmentFile)
COMPOSE_PROJECT_NAME=$(Get-QuotedEnvValue $ResolvedComposeProjectName)
DEPLOYMENT_ENVIRONMENT=$EnvironmentName
RELEASE_SHA=$(Get-QuotedEnvValue $BackendImageTag)
OBSERVABILITY_COMPOSE_PROJECT_NAME=$(Get-QuotedEnvValue $ResolvedObservabilityProjectName)
OBSERVABILITY_BACKEND_NETWORK=$(Get-QuotedEnvValue $ResolvedObservabilityBackendNetwork)
ALERTMANAGER_HOST_PORT=$AlertmanagerHostPort
PROMETHEUS_HOST_PORT=$PrometheusHostPort
LOKI_HOST_PORT=$LokiHostPort
TEMPO_HOST_PORT=$TempoHostPort
ALLOY_HOST_PORT=$AlloyHostPort
GRAFANA_HOST_PORT=$GrafanaHostPort

NODE_IMAGE=node:24.15.0-bookworm-slim
FRONTEND_NODE_IMAGE=node:24.15.0-alpine

POSTGRES_IMAGE=postgres:17.10-alpine3.23
REDIS_IMAGE=redis:7.4.10-alpine3.21
CADDY_IMAGE=caddy:2.11.4-alpine
ALERTMANAGER_IMAGE=$(Get-QuotedEnvValue $AlertmanagerImage)

BACKEND_IMAGE_NAME=$(Get-QuotedEnvValue $BackendImageName)
BACKEND_IMAGE_TAG=$(Get-QuotedEnvValue $BackendImageTag)

FRONTEND_IMAGE_NAME=$(Get-QuotedEnvValue $FrontendImageName)
FRONTEND_IMAGE_TAG=$(Get-QuotedEnvValue $FrontendImageTag)

APP_DOMAIN=$(Get-QuotedEnvValue $PublicDomain)

ACME_EMAIL=$(Get-QuotedEnvValue $AcmeEmail)

POSTGRES_MEMORY_LIMIT=1536m
POSTGRES_CPU_LIMIT=1.50
POSTGRES_SHM_SIZE=256m

REDIS_MEMORY_LIMIT=512m
REDIS_CPU_LIMIT=0.75

API_MEMORY_LIMIT=768m
API_CPU_LIMIT=1.00

WORKER_MEMORY_LIMIT=768m
WORKER_CPU_LIMIT=1.00

FRONTEND_MEMORY_LIMIT=256m
FRONTEND_CPU_LIMIT=0.50

CADDY_MEMORY_LIMIT=256m
CADDY_CPU_LIMIT=0.50

RECOVERY_METRICS_MEMORY_LIMIT=128m
RECOVERY_METRICS_CPU_LIMIT=0.25
BACKUP_RPO_HOURS=26
RESTORE_DRILL_MAX_AGE_DAYS=8

ALERTMANAGER_MEMORY_LIMIT=256m
ALERTMANAGER_CPU_LIMIT=0.25

BACKUP_MEMORY_LIMIT=512m
BACKUP_CPU_LIMIT=0.75
POSTGRES_BACKUP_DIRECTORY=./backups
BACKUP_RETENTION_DAYS=14
POSTGRES_DB=$(Get-QuotedEnvValue $PostgresDatabase)
POSTGRES_USER=$(Get-QuotedEnvValue $PostgresUser)
POSTGRES_PASSWORD=$PostgresPassword
REDIS_PASSWORD=$RedisPassword
DATABASE_URL=postgresql://$(Assert-SingleLineValue $PostgresUser):$EncodedPostgresPassword@postgres:5432/$(Assert-SingleLineValue $PostgresDatabase)?schema=public
REDIS_URL=redis://:$EncodedRedisPassword@redis:6379/0
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
APP_PUBLIC_URL=https://$(Assert-SingleLineValue $PublicDomain)
TRUST_PROXY=true
HTTP_REQUEST_TIMEOUT_MS=15000
JSON_BODY_LIMIT=2mb
URL_ENCODED_BODY_LIMIT=2mb
SWAGGER_ENABLED=false
DEFAULT_LOCALE=vi-VN
SUPPORTED_LOCALES=vi-VN,en-US
OBSERVABILITY_ENABLED=true
LOG_LEVEL=info
LOG_PRETTY=false
LOG_INCLUDE_SOURCE=false
SERVICE_INSTANCE_ID=
METRICS_ENABLED=true
METRICS_PATH=/internal/metrics
METRICS_BEARER_TOKEN=$MetricsToken
METRICS_DEFAULT_ENABLED=true
METRICS_SNAPSHOT_INTERVAL_MS=10000
OTEL_SDK_DISABLED=false
OTEL_SERVICE_NAME=quan-ly-truyen-api
OTEL_SERVICE_VERSION=0.0.1
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://alloy:4318/v1/traces
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.10
OTEL_BSP_EXPORT_TIMEOUT=3000
OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512
OTEL_BSP_SCHEDULE_DELAY=5000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$GrafanaPassword
CORS_ALLOWED_ORIGINS=https://$(Assert-SingleLineValue $PublicDomain)
CORS_CREDENTIALS=true
CORS_MAX_AGE_SECONDS=86400
JWT_ACCESS_SECRET=$JwtAccessSecret
JWT_REFRESH_SECRET=$JwtRefreshSecret
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
JWT_ISSUER=quan-ly-truyen-api
JWT_AUDIENCE=quan-ly-truyen-web
AUTH_REFRESH_COOKIE_NAME=refresh_token
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_PATH=/api/v1/auth
AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED=true
AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS=15
AUTH_LOGIN_RATE_LIMIT_ENABLED=true
AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS=900
AUTH_LOGIN_RATE_LIMIT_IP_LIMIT=20
AUTH_LOGIN_RATE_LIMIT_IDENTIFIER_LIMIT=5
AUTH_JWT_BLACKLIST_ENABLED=true
AUTH_JWT_BLACKLIST_FAILURE_MODE=closed
AUTH_ADMIN_MFA_ENABLED=true
AUTH_ADMIN_MFA_ISSUER=Quan Ly Truyen
AUTH_MFA_ENCRYPTION_KEY=$MfaEncryptionKey
AUTH_MFA_PREAUTH_TTL_SECONDS=300
AUTH_MFA_MAX_VERIFICATION_ATTEMPTS=5
AUTH_MFA_TOTP_WINDOW=1
AUTH_MFA_RECOVERY_CODE_COUNT=10
AUTH_OAUTH_ENABLED=false
AUTH_OAUTH_STATE_TTL_SECONDS=600
AUTH_OAUTH_STATE_COOKIE_NAME=oauth_state
AUTH_OAUTH_GOOGLE_ENABLED=false
AUTH_OAUTH_GOOGLE_CLIENT_ID=
AUTH_OAUTH_GOOGLE_CLIENT_SECRET=
AUTH_OAUTH_GOOGLE_CALLBACK_URL=https://$(Assert-SingleLineValue $PublicDomain)/api/v1/auth/oauth/google/callback
AUTH_OAUTH_GITHUB_ENABLED=false
AUTH_OAUTH_GITHUB_CLIENT_ID=
AUTH_OAUTH_GITHUB_CLIENT_SECRET=
AUTH_OAUTH_GITHUB_CALLBACK_URL=https://$(Assert-SingleLineValue $PublicDomain)/api/v1/auth/oauth/github/callback
AUTH_CSRF_ENABLED=true
AUTH_CSRF_SECRET=$CsrfSecret
AUTH_CSRF_COOKIE_NAME=csrf_token
AUTH_CSRF_COOKIE_DOMAIN=
AUTH_CSRF_COOKIE_PATH=/
AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS=60
AUTH_MAX_ACTIVE_SESSIONS=10
AUTH_SESSION_LIST_LIMIT=20
AUTH_SECURITY_EVENT_HISTORY_LIMIT=50
REDIS_ENABLED=true
REDIS_KEY_PREFIX=qlt
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_COMMAND_TIMEOUT_MS=3000
CACHE_DEFAULT_TTL_SECONDS=300
QUEUE_ENABLED=true
QUEUE_PREFIX=qlt
QUEUE_DEFAULT_ATTEMPTS=3
QUEUE_DEFAULT_BACKOFF_MS=5000
WORKER_CONCURRENCY=5
WORKER_ROLE=all
OUTBOX_PROCESSING_TIMEOUT_MS=60000
OUTBOX_BATCH_SIZE=50
OUTBOX_POLL_INTERVAL_MS=10000
OUTBOX_FAILED_ALERT_THRESHOLD=5
QUEUE_WORKER_HEARTBEAT_ENABLED=true
QUEUE_WORKER_HEARTBEAT_INTERVAL_MS=10000
QUEUE_WORKER_HEARTBEAT_TTL_SECONDS=30
IDEMPOTENCY_FAILURE_MODE=closed
IDEMPOTENCY_MAX_RESPONSE_BYTES=1048576
ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK=false
IN_MEMORY_STORE_MAX_ENTRIES=10000
IN_MEMORY_STORE_SWEEP_INTERVAL_MS=60000
MAIL_PAYLOAD_ENCRYPTION_KEY=$MailEncryptionKey
MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ=false
MAIL_ENABLED=true
MAIL_FROM_NAME=$(Get-QuotedEnvValue $MailFromName)
MAIL_FROM_ADDRESS=$(Get-QuotedEnvValue $MailFromAddress)
MAIL_REPLY_TO=$(Get-QuotedEnvValue $ReplyTo)
FRONTEND_PUBLIC_URL=https://$(Assert-SingleLineValue $PublicDomain)
MAIL_MESSAGE_ID_DOMAIN=$(Get-QuotedEnvValue $MailDomain)
SMTP_HOST=$(Get-QuotedEnvValue $SmtpHost)
SMTP_PORT=$SmtpPort
SMTP_SECURE=$SmtpSecureValue
SMTP_REQUIRE_TLS=$SmtpRequireTlsValue
SMTP_USERNAME=$(Get-QuotedEnvValue $SmtpUsername)
SMTP_PASSWORD=$(Get-QuotedEnvValue $SmtpPassword)
SMTP_POOL_ENABLED=true
SMTP_MAX_CONNECTIONS=3
SMTP_MAX_MESSAGES=100
SMTP_RATE_LIMIT_PER_SECOND=5
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=30000
SMTP_VERIFY_ON_STARTUP=true
MAIL_DKIM_ENABLED=$DkimEnabledValue
MAIL_DKIM_DOMAIN=$(Get-QuotedEnvValue $DkimDomain)
MAIL_DKIM_SELECTOR=$(Get-QuotedEnvValue $DkimSelector)
MAIL_DKIM_PRIVATE_KEY_BASE64=$DkimKeyBase64
MAIL_QUEUE_COMPLETED_RETENTION_SECONDS=3600
MAIL_QUEUE_COMPLETED_RETENTION_COUNT=100
MAIL_QUEUE_FAILED_RETENTION_SECONDS=604800
MAIL_QUEUE_FAILED_RETENTION_COUNT=1000
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE=Hệ thống đang bảo trì
MAINTENANCE_RETRY_AFTER_SECONDS=300
MAINTENANCE_BYPASS_HEADER=x-maintenance-key
MAINTENANCE_BYPASS_TOKEN=$MaintenanceBypassToken
PRODUCTION_GATE_MIGRATIONS_PATH=prisma/migrations
PRODUCTION_GATE_CLEANUP_MAX_AGE_HOURS=30
CLOUDINARY_ENABLED=false
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_ROOT_FOLDER=quan-ly-truyen
CLOUDINARY_SIGNATURE_ALGORITHM=sha256
CLOUDINARY_UPLOAD_INTENT_TTL_SECONDS=300
CLOUDINARY_READY_ORPHAN_GRACE_SECONDS=3600
CLOUDINARY_WEBHOOK_SIGNATURE_TTL_SECONDS=300
CLOUDINARY_WEBHOOK_POLL_INTERVAL_MS=1000
CLOUDINARY_WEBHOOK_BATCH_SIZE=100
CLOUDINARY_WEBHOOK_MAX_ATTEMPTS=5
CLOUDINARY_WEBHOOK_RETRY_BASE_MS=5000
CLOUDINARY_DELETE_MAX_ATTEMPTS=5
CLOUDINARY_DELETE_RETRY_BASE_MS=5000

RESTIC_IMAGE=$(Get-QuotedEnvValue $ResticImage)
OFFSITE_BACKUP_ENABLED=true
BACKUP_HOST_ID=quan-ly-truyen-$EnvironmentName
RESTIC_REPOSITORY=$(Get-QuotedEnvValue $ResticRepository)
BACKUP_S3_ACCESS_KEY_ID=$(Get-QuotedEnvValue $BackupS3AccessKeyId)
BACKUP_S3_SECRET_ACCESS_KEY=$(Get-QuotedEnvValue $BackupS3SecretAccessKey)
BACKUP_S3_REGION=$(Get-QuotedEnvValue $BackupS3Region)
RESTIC_KEEP_DAILY=14
RESTIC_KEEP_WEEKLY=8
RESTIC_KEEP_MONTHLY=12
BACKUP_OFFSITE_MEMORY_LIMIT=512m
BACKUP_OFFSITE_CPU_LIMIT=0.50
RESTORE_DRILL_POSTGRES_DB=qlt_restore_drill
RESTORE_DRILL_POSTGRES_USER=qlt_restore
RESTORE_DRILL_POSTGRES_PASSWORD=$RestoreDrillPostgresPassword
RESTORE_DRILL_TMPFS_SIZE=2g
RESTORE_DRILL_MEMORY_LIMIT=1024m
RESTORE_DRILL_CPU_LIMIT=1.00
"@

New-Item -ItemType Directory -Path $SecretsDirectory -Force | Out-Null
[IO.File]::WriteAllText($OutputPath, $Content.Trim() + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($MetricsTokenFile, $MetricsToken + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText(
  $ResticPasswordFile,
  $ResticRepositoryPassword + [Environment]::NewLine,
  [Text.UTF8Encoding]::new($false)
)
[IO.File]::WriteAllText(
  $AlertWebhookFile,
  (Assert-SingleLineValue $AlertWebhookUrl) + [Environment]::NewLine,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "Created: $OutputPath" -ForegroundColor Green
Write-Host "Created: $MetricsTokenFile" -ForegroundColor Green
Write-Host "Created: $ResticPasswordFile" -ForegroundColor Green
Write-Host "Created: $AlertWebhookFile" -ForegroundColor Green
Write-Host 'Store the Restic password separately from object-storage credentials. Losing it makes encrypted backups unrecoverable.' -ForegroundColor Yellow
Write-Host 'Store both files securely. Never commit them.' -ForegroundColor Yellow
Write-Host 'Next: npm run ci:check-env' -ForegroundColor Cyan
