# Monetization Production Runbook

## Safety invariants

- PostgreSQL `wallet_ledger_entries` is the financial source of truth. Never edit a
  wallet balance or ledger row manually.
- Every ledger transaction has exactly one wallet entry and one system entry; their
  signed sum is zero and the wallet entry equals `wallet_amount`.
- A paid order references one `TOP_UP` transaction. A completed chapter purchase
  references one `CHAPTER_PURCHASE` transaction and an active entitlement. Refunds
  append a `REFUND` transaction; history is never rewritten.
- A locked chapter response must contain `previewContent` and must not contain
  `content` or `contentFormat`.

## Kill switches

Apply the least disruptive switch first and redeploy the same immutable SHA:

1. `PAYMENT_PROVIDER_ENABLED=false` stops new top-up checkouts and webhook polling.
2. `AUTHOR_PRICING_ENABLED=false` stops pricing changes.
3. `PAYWALL_ENFORCEMENT_ENABLED=false` restores full reader access while preserving
   purchases and ledger history.
4. `MONETIZATION_ENABLED=false` hides wallet, billing and monetization APIs.

Money movement is fail-closed when its Redis rate-limit store is unavailable. Restore
Redis health instead of bypassing the limiter while monetization remains enabled.

Disabling a switch does not reverse ledger entries. Refund through the admin flow or
the verified provider webhook only.

## Required checks before every stage

```powershell
npm run db:migrate:status
npm run db:verify:constraints
npm run maintenance:wallet-reconciliation
./ops/production/Test-PostgresRestoreDrill.ps1
./ops/production/Test-RecoveryReadiness.ps1
npm run observability:smoke
```

Prometheus must report:

- `qlt_monetization_integrity_snapshot_healthy == 1`;
- every `qlt_monetization_financial_integrity_mismatches` series equals `0`;
- outbox, mail and payment webhook queues have no stale/failed backlog;
- API 5xx ratio and P95 latency remain inside the normal release thresholds.

Run the content-leak probe against a paid test chapter whose unique sentinel occurs
only after the generated preview:

```powershell
$env:MONETIZATION_SECURITY_TEST_BASE_URL='https://103.74.100.55.nip.io/api/v1'
$env:MONETIZATION_SECURITY_TEST_STORY_SLUG='<story-slug>'
$env:MONETIZATION_SECURITY_TEST_CHAPTER_NUMBER='1'
$env:MONETIZATION_SECURITY_TEST_FULL_CONTENT_SENTINEL='<unique-sentinel>'
$env:MONETIZATION_SECURITY_TEST_OUTSIDER_TOKEN='<non-entitled-access-token>'
npm run security:test:monetization-content
```

## Stage 1: sandbox

Use staging only. Set `MONETIZATION_ROLLOUT_STAGE=sandbox`, populate
`MONETIZATION_INTERNAL_USER_IDS`, enable the HMAC sandbox provider, and keep all real
merchant credentials out of this environment. Verify successful, duplicate, invalid
signature, expired signature, failure, refund and reversal webhooks.

## Stage 2: internal users

Production forbids the sandbox adapter. Configure the reviewed real provider adapter,
set `MONETIZATION_ROLLOUT_STAGE=internal`, and keep a short UUID allowlist in
`MONETIZATION_INTERNAL_USER_IDS`. Enable paywall enforcement only after the restore
drill and content-leak probe pass. Review each ledger transaction and receipt.

## Stage 3: selected stories

Set `MONETIZATION_ROLLOUT_STAGE=story_allowlist` and populate
`MONETIZATION_STORY_ALLOWLIST_IDS`. Only those stories, plus internal users, are
enforced. Use chapters dedicated to rollout testing and record author approval.

Concurrency probe preconditions: a funded rollout user who does not yet own the paid
chapter. The script generates a distinct disposable idempotency key per request and is
bounded to the 30-request unlock rate-limit window.

```powershell
$env:MONETIZATION_LOAD_TEST_BASE_URL='https://103.74.100.55.nip.io/api/v1'
$env:MONETIZATION_LOAD_TEST_ACCESS_TOKEN='<rollout-user-access-token>'
$env:MONETIZATION_LOAD_TEST_CHAPTER_ID='<unowned-paid-chapter-uuid>'
$env:MONETIZATION_LOAD_TEST_CONCURRENCY='25'
$env:MONETIZATION_LOAD_TEST_MAX_P95_MS='1500'
npm run loadtest:monetization-unlock
```

The probe passes only when every response references one purchase and one ledger
transaction, the wallet is debited exactly once, and P95 stays below the configured
threshold.

## Stage 4: general rollout

Set `MONETIZATION_ROLLOUT_STAGE=general`. Observe at least one full traffic cycle
before increasing the number of paid chapters. Do not advance while any financial
integrity, recovery, content-leak, SMTP/outbox, webhook or latency gate is red.

## Incident response

1. Stop new money movement with the relevant kill switch.
2. Preserve request ID, order/purchase ID and provider event key; never copy access
   tokens, webhook secrets or full chapter content into chat or tickets.
3. Run wallet reconciliation and query the immutable ledger through approved admin
   tooling.
4. For duplicate/replayed requests, compare idempotency key and request hash.
5. For a confirmed accounting error, append a compensating entry; never update or
   delete historical ledger rows.
6. If restoration is required, follow `PRODUCTION_RUNBOOK.md`. Application rollback
   alone does not roll back database state.
