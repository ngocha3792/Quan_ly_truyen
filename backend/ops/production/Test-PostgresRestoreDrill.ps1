[CmdletBinding()]
param(
  [string]$EnvironmentFile = '.env.production',
  [switch]$KeepArtifacts
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
    throw ("docker compose failed: {0}" -f ($Arguments -join ' '))
  }
}

$DrillDatabase =
  Get-EnvValue `
    -Name 'RESTORE_DRILL_POSTGRES_DB'

$DrillUser =
  Get-EnvValue `
    -Name 'RESTORE_DRILL_POSTGRES_USER'

$DrillPassword =
  Get-EnvValue `
    -Name 'RESTORE_DRILL_POSTGRES_PASSWORD'

if (-not $DrillDatabase) {
  $DrillDatabase =
    'qlt_restore_drill'
}

if (-not $DrillUser) {
  $DrillUser =
    'qlt_restore'
}

if (
  [string]::IsNullOrWhiteSpace(
    $DrillPassword
  )
) {
  throw 'RESTORE_DRILL_POSTGRES_PASSWORD is missing.'
}


$BackupDirectoryValue =
  Get-EnvValue `
    -Name 'POSTGRES_BACKUP_DIRECTORY'

if ([string]::IsNullOrWhiteSpace($BackupDirectoryValue)) {
  $BackupDirectoryValue = './backups'
}

$BackupDirectory =
  if ([IO.Path]::IsPathRooted($BackupDirectoryValue)) {
    $BackupDirectoryValue
  } else {
    Join-Path $BackendRoot $BackupDirectoryValue
  }

$RestoreDrillRoot =
  Join-Path `
    $BackupDirectory `
    'restore-drill'

$Timestamp =
  [DateTime]::UtcNow.ToString(
    'yyyyMMddTHHmmssZ'
  )

$RestoreRoot =
  Join-Path `
    $RestoreDrillRoot `
    $Timestamp

New-Item `
  -ItemType Directory `
  -Path $RestoreRoot `
  -Force |
Out-Null

$DrillStarted = $false

try {
  # ----------------------------------------------------------
  # 1. Restore latest snapshot FROM OFF-HOST STORAGE
  # ----------------------------------------------------------

  Write-Host `
    'Restoring latest encrypted off-host snapshot...' `
    -ForegroundColor Cyan

  Invoke-Compose `
    --profile maintenance `
    run `
    --rm `
    --no-deps `
    --volume "${RestoreRoot}:/restore" `
    backup-offsite `
    restore `
    latest `
    --tag postgres `
    --target /restore


  $RestoredBackupRoot =
    Join-Path `
      $RestoreRoot `
      'backups'

  $Dump =
    Get-ChildItem `
      -LiteralPath $RestoredBackupRoot `
      -Filter '*.dump' `
      -File `
      -Recurse |
    Sort-Object `
      LastWriteTimeUtc `
      -Descending |
    Select-Object -First 1

  if (-not $Dump) {
    throw (
      'Off-host restore completed but no PostgreSQL dump was found.'
    )
  }


  # ----------------------------------------------------------
  # 2. SHA-256 verification
  # ----------------------------------------------------------

  $ChecksumPath =
    "$($Dump.FullName).sha256"

  if (
    -not (
      Test-Path `
        -LiteralPath $ChecksumPath `
        -PathType Leaf
    )
  ) {
    throw ("Restored checksum file missing: {0}" -f $ChecksumPath)
  }

  $ExpectedHash =
    (
      Get-Content `
        -LiteralPath $ChecksumPath `
        -TotalCount 1
    ).Split(
      ' ',
      [StringSplitOptions]::RemoveEmptyEntries
    )[0].ToLowerInvariant()

  $ActualHash =
    (
      Get-FileHash `
        -LiteralPath $Dump.FullName `
        -Algorithm SHA256
    ).Hash.ToLowerInvariant()

  if ($ExpectedHash -cne $ActualHash) {
    throw (
      "SHA-256 mismatch. Expected=$ExpectedHash Actual=$ActualHash"
    )
  }

  Write-Host `
    'Off-host backup SHA-256 verification passed.' `
    -ForegroundColor Green

  & (Join-Path $PSScriptRoot 'Test-PostgresBackupArtifact.ps1') `
    -BackupFile $Dump.FullName `
    -EnvironmentFile $EnvironmentFilePath `
    -SkipAgeCheck |
  Out-Null


  # ----------------------------------------------------------
  # 3. Start disposable PostgreSQL
  # ----------------------------------------------------------

  Write-Host `
    'Starting disposable restore-drill PostgreSQL...' `
    -ForegroundColor Cyan

  Invoke-Compose `
    --profile restore-drill `
    up `
    -d `
    --wait `
    postgres-restore-drill

  $DrillStarted = $true


  # ----------------------------------------------------------
  # 4. Actually pg_restore the backup
  # ----------------------------------------------------------

  Write-Host `
    'Restoring dump into disposable PostgreSQL...' `
    -ForegroundColor Cyan

  Invoke-Compose `
    --profile maintenance `
    --profile restore-drill `
    run `
    --rm `
    --no-deps `
    --volume "$($Dump.FullName):/restore/restore.dump:ro" `
    --env "PGPASSWORD=$DrillPassword" `
    --entrypoint pg_restore `
    backup-postgres `
    --host=postgres-restore-drill `
    "--username=$DrillUser" `
    "--dbname=$DrillDatabase" `
    --no-owner `
    --no-privileges `
    --exit-on-error `
    /restore/restore.dump


  # ----------------------------------------------------------
  # 5. Database sanity verification
  # ----------------------------------------------------------

  Write-Host `
    'Running restored database sanity checks...' `
    -ForegroundColor Cyan

  $SanitySql = @'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No successful Prisma migrations were restored';
  END IF;

  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.stories') IS NULL
     OR to_regclass('public.chapters') IS NULL
     OR to_regclass('public.outbox_events') IS NULL
     OR to_regclass('public.wallets') IS NULL
     OR to_regclass('public.wallet_ledger_transactions') IS NULL
     OR to_regclass('public.wallet_ledger_entries') IS NULL
     OR to_regclass('public.chapter_purchases') IS NULL
     OR to_regclass('public.chapter_entitlements') IS NULL
     OR to_regclass('public.payment_orders') IS NULL THEN
    RAISE EXCEPTION 'One or more critical application tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wallet_ledger_transactions AS ledger_transaction
    LEFT JOIN wallet_ledger_entries AS ledger_entry
      ON ledger_entry.transaction_id = ledger_transaction.id
    GROUP BY ledger_transaction.id
    HAVING COUNT(ledger_entry.id) <> 2
       OR COALESCE(SUM(ledger_entry.amount), 0) <> 0
       OR COUNT(ledger_entry.id) FILTER (
         WHERE ledger_entry.wallet_id = ledger_transaction.wallet_id
       ) <> 1
       OR COUNT(ledger_entry.id) FILTER (
         WHERE ledger_entry.system_account IS NOT NULL
       ) <> 1
       OR COALESCE(SUM(ledger_entry.amount) FILTER (
         WHERE ledger_entry.wallet_id = ledger_transaction.wallet_id
       ), 0) <> ledger_transaction.wallet_amount
  ) THEN
    RAISE EXCEPTION 'Restored ledger contains an unbalanced transaction';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wallets AS wallet
    LEFT JOIN (
      SELECT wallet_id, COALESCE(SUM(amount), 0) AS ledger_balance
      FROM wallet_ledger_entries
      WHERE wallet_id IS NOT NULL
      GROUP BY wallet_id
    ) AS ledger ON ledger.wallet_id = wallet.id
    WHERE wallet.balance <> COALESCE(ledger.ledger_balance, 0)
  ) THEN
    RAISE EXCEPTION 'Restored wallet balance does not match ledger';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM chapter_purchases AS purchase
    LEFT JOIN wallet_ledger_transactions AS debit
      ON debit.id = purchase.wallet_transaction_id
    LEFT JOIN wallet_ledger_transactions AS refund
      ON refund.id = purchase.refund_wallet_transaction_id
    WHERE debit.type IS DISTINCT FROM 'chapter_purchase'
       OR debit.wallet_amount IS DISTINCT FROM -purchase.credit_price
       OR (
         purchase.status = 'refunded'
         AND (
           refund.type IS DISTINCT FROM 'refund'
           OR refund.wallet_amount IS DISTINCT FROM purchase.credit_price
         )
       )
  ) THEN
    RAISE EXCEPTION 'Restored chapter purchase ledger references are invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payment_orders AS payment
    LEFT JOIN wallet_ledger_transactions AS ledger_transaction
      ON ledger_transaction.id = payment.wallet_transaction_id
    WHERE payment.status = 'paid'
      AND (
        ledger_transaction.type IS DISTINCT FROM 'top_up'
        OR ledger_transaction.wallet_amount IS DISTINCT FROM payment.credit_amount
      )
  ) THEN
    RAISE EXCEPTION 'Restored paid order ledger references are invalid';
  END IF;
END
$$;

SELECT json_build_object(
  'users', (SELECT COUNT(*) FROM users),
  'stories', (SELECT COUNT(*) FROM stories),
  'chapters', (SELECT COUNT(*) FROM chapters),
  'wallets', (SELECT COUNT(*) FROM wallets),
  'ledgerTransactions', (SELECT COUNT(*) FROM wallet_ledger_transactions),
  'ledgerEntries', (SELECT COUNT(*) FROM wallet_ledger_entries),
  'chapterPurchases', (SELECT COUNT(*) FROM chapter_purchases),
  'chapterEntitlements', (SELECT COUNT(*) FROM chapter_entitlements),
  'paymentOrders', (SELECT COUNT(*) FROM payment_orders),
  'migrations', (
    SELECT COUNT(*)
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  )
);
'@

  & docker compose `
    --env-file $EnvironmentFilePath `
    -f compose.production.yml `
    --profile maintenance `
    --profile restore-drill `
    run `
    --rm `
    --no-deps `
    --env "PGPASSWORD=$DrillPassword" `
    --entrypoint psql `
    backup-postgres `
    --host=postgres-restore-drill `
    "--username=$DrillUser" `
    "--dbname=$DrillDatabase" `
    --no-align `
    --tuples-only `
    --set ON_ERROR_STOP=1 `
    --command $SanitySql

  if ($LASTEXITCODE -ne 0) {
    throw (
      'Restored database Prisma migration verification failed.'
    )
  }


  New-Item `
    -ItemType Directory `
    -Path $RestoreDrillRoot `
    -Force |
  Out-Null

  $RestoreStatus = [ordered]@{
    version = 2
    completedAt = [DateTime]::UtcNow.ToString('o')
    dumpFile = $Dump.Name
    source = 'offsite-restic'
    sha256 = $ActualHash
    ledgerVerified = $true
  }

  $RestoreStatusPath =
    Join-Path $RestoreDrillRoot 'restore-drill-last-success.json'

  $RestoreStatusJson = $RestoreStatus | ConvertTo-Json
  $TemporaryRestoreStatusPath = "$RestoreStatusPath.tmp"

  [IO.File]::WriteAllText(
    $TemporaryRestoreStatusPath,
    $RestoreStatusJson + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false)
  )

  Move-Item `
    -LiteralPath $TemporaryRestoreStatusPath `
    -Destination $RestoreStatusPath `
    -Force

  Write-Host ("RESTORE DRILL PASSED: {0}" -f $Dump.Name) -ForegroundColor Green
}
finally {
  if ($DrillStarted) {
    & docker compose `
      --env-file $EnvironmentFilePath `
      -f compose.production.yml `
      --profile restore-drill `
      rm `
      -s `
      -f `
      postgres-restore-drill |
    Out-Null
  }

  if (
    -not $KeepArtifacts -and
    (
      Test-Path `
        -LiteralPath $RestoreRoot
    )
  ) {
    Remove-Item `
      -LiteralPath $RestoreRoot `
      -Recurse `
      -Force
  }
}
