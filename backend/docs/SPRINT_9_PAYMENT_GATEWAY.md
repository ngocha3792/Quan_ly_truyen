# Sprint 9 — Early access and VNPAY

## Admin setup without merchant keys

Open `/admin/settings/payments` and add a VNPAY connection. Enter a stable code,
display name and VND currency; choose Sandbox or Production. Save with activation
off. Missing merchant fields/keys do not prevent saving a draft. The response
includes `configurationReady`, `missingConfigurationFields`,
`secretConfiguredFields`, `credentialsStorageAvailable`, IPN URL and return URL.

When VNPAY provides merchant credentials, enter TmnCode and HashSecret, save,
then activate. Blank secret inputs preserve the existing key. Read APIs never
return secret plaintext or the encrypted envelope. Config rejects embedded
secret fields and arbitrary payment endpoints. Gateway URLs are fixed by the
selected environment. Production deployment refuses activation/checkout using
Sandbox credentials. Saving a disabled Sandbox draft remains allowed.

Fields:

| Field | Meaning |
| --- | --- |
| environment | SANDBOX or PRODUCTION |
| tmnCode | VNPAY-issued 8-character merchant code |
| hashSecret | Write-only merchant signing key, entered in credentials |
| returnUrl | Same-origin website URL `/tai-khoan/credit/ket-qua-thanh-toan` |
| serverIp | Outbound VPS IP for query/refund requests |
| locale | vn or en |

Register the displayed HTTPS IPN URL with VNPAY:
`/api/v1/webhooks/payments/:providerCode/ipn`.
The adapter adds the internal `orderId` to the browser return URL. The return page
ignores callback success flags; it polls the authenticated own-order endpoint.
Only server-confirmed settlement grants Credit.

## Credential storage

The existing `PaymentProviderConnection.encryptedCredential` stores AES-256-GCM
envelopes with random IVs and provider-code AAD. A dedicated canonical 32-byte
Base64 `PAYMENT_PROVIDER_CREDENTIAL_KEY` may be configured. When omitted, the
vault derives a payment-specific key from the existing
`AUTH_MFA_ENCRYPTION_KEY` using HKDF. No provider merchant key is required in env.
If neither master key is available, drafts still work and the UI shows storage
unavailable; saving actual credentials fails closed. Keep the master key stable
and backed up; replacing it without re-encryption makes existing envelopes
unreadable. Do not paste master/provider keys into logs or Git.

Each order captures its merchant config and encrypted credential snapshot.
Retries use the captured merchant config, and valid callbacks/reconciliation
continue working after a provider is disabled or its settings change. This
snapshot does not make VNPAY accept an old key after it is revoked at VNPAY;
coordinate merchant rotations so outstanding orders can still be verified.

## Rollout and early access

Admin settings include story rollout: set a story ID, enable rollout, select
VNPAY, save. VNPAY checkout requires a published/public story in this allowlist,
an active configured provider, and the existing global monetization/payment
feature and account rollout flags. Payment methods filter by `storyId`; paywall
links carry the story into the Credit page. Manual transfer remains unchanged.

Early-access pricing uses the existing schema. Authors choose permanent paid or
early access with exactly one of a UTC `freeAt` timestamp or `paidWindowDays`
(1–3650). Relative windows begin at actual publication, not when the schedule is
created. At `now >= freeAt` the shared policy returns FREE for reader, comments,
TTS, offline and search labels. Searches keep deliberate public previews rather
than exporting formerly paid bodies. Existing purchases/entitlements and price
snapshots remain permanent. A new purchase after expiry is rejected without a
debit. See [EARLY_ACCESS.md](./EARLY_ACCESS.md).

## Provider protocol and accounting

VNPAY 2.1.0 checkout uses sorted URL-encoded HMAC-SHA512 parameters, GMT+7 dates,
stable order references and VND amount multiplied by 100. IPN verifies signatures
with constant-time comparison and binds merchant, local order/reference, amount
and currency. Valid events enter the existing durable webhook inbox. Success
settles synchronously before acknowledging IPN; failed processing asks VNPAY to
retry and the worker can resume from the inbox. Replays never credit twice.
Disabling checkout does not disable callbacks for existing orders.

The existing `PaymentOrder`, `InboundWebhookEvent`, `WalletLedgerTransaction`
and double-entry ledger are reused; no parallel payment transaction table was
created. VNPAY transaction IDs/dates and last reconciliation time are retained.
Signed success found after local expiry/failure can settle through the same
idempotent ledger path. Frontend redirects are not payment evidence.

Admin `/admin/payments/gateway` provides per-order reconciliation and whole-order
refunds. `querydr` and refund responses require verified signatures and matching
merchant/reference/amount/transaction type. Partial refunds are not represented
as full refunds. An unverified response, timeout or ambiguous state remains
UNKNOWN; in-progress refunds remain PENDING.

Refund requests reserve the full purchased Credit using a double-entry debit
before calling VNPAY. Insufficient available Credit rejects the request before
network access. Success completes the refund without another debit. A definitive
failure restores Credit through an idempotent compensating entry. UNKNOWN or
PENDING keeps the reservation and prevents another refund attempt. Reconciliation
may confirm the full refund later. An original payment still marked successful
does not prove a pending refund failed and does not release the reservation.

External full refunds without a local reservation debit only once; an order
never credited locally can be marked refunded without a debit. Orders with spent
Credit or an unresolved external reversal require operational review; the system
does not create a negative balance or pretend the discrepancy is reconciled.

## API and deployment

New admin APIs:

- GET/PUT `/admin/billing/story-allowlists/:storyId` — provider-management permission.
- POST `/admin/billing/payment-orders/:orderId/reconcile` — reconciliation permission.
- GET/POST `/admin/billing/payment-orders/:orderId/refunds` — refund permission.

Refund POST requires `reason` and `x-idempotency-key`. The same key+request
replays the stored operation; another request with the same key is rejected.
Secrets are sent only as `credentials: {hashSecret}` in admin create/update.
Public method lists expose no configuration or credential metadata.

Deploy migration `20260910030000_production_gateway_rollout`, regenerate Prisma,
then release API/worker/frontend together. No keys or live providers are enabled
by migration. Existing manual/sandbox records and orders are preserved. Existing
feature flags (`MONETIZATION_ENABLED`, `PAYMENT_PROVIDER_ENABLED`, rollout stage)
remain operator-controlled. The API contract manifest/matrix includes gateway
operations and allowlists.

Verification:

```powershell
node scripts/verify-api-contracts.mjs
cd backend
npm run db:validate
npm run architecture:check
npm run lint:check
npm run typecheck:scripts
npm run build
npm test -- --runInBand
npm run test:billing:integration
npm run test:monetization:integration
npm run test:offline-reading:integration
npm run test:search:integration
cd ../frontend
npm run quality:check
npm run test:ci
npm run build:ci
npx playwright test e2e/public/payment-gateway-ui.spec.ts e2e/public/early-access-pricing-ui.spec.ts --project=public-chromium
```

Unit/provider fixtures and browser tests use controlled responses; no money is
moved. PostgreSQL integration fixtures cover setup, allowlist, IPN replay/key
rotation, ledger reservations/refunds and exact early-access boundaries, but local
runtime remains unverified while test PostgreSQL at 127.0.0.1:5433 is unavailable.
No merchant keys were supplied, so real VNPAY sandbox/live charging, refunds,
merchant callback registration and provider reconciliation remain unverified.

Provider references: [VNPAY PAY/IPN](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html)
and [querydr/refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html).
