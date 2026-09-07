import { randomUUID } from 'node:crypto';

const baseUrl = requireEnv('MONETIZATION_LOAD_TEST_BASE_URL').replace(
  /\/$/u,
  '',
);
const accessToken = requireEnv('MONETIZATION_LOAD_TEST_ACCESS_TOKEN');
const chapterId = requireEnv('MONETIZATION_LOAD_TEST_CHAPTER_ID');
const concurrency = boundedInteger(
  process.env.MONETIZATION_LOAD_TEST_CONCURRENCY,
  25,
  2,
  30,
);
const maximumP95Ms = boundedInteger(
  process.env.MONETIZATION_LOAD_TEST_MAX_P95_MS,
  1_500,
  100,
  30_000,
);
const csrfToken = process.env.MONETIZATION_LOAD_TEST_CSRF_TOKEN?.trim();

void main();

async function main(): Promise<void> {
  const before = await readWallet();
  const results = await Promise.all(
    Array.from({ length: concurrency }, () =>
      unlock(`load-unlock-${randomUUID()}`),
    ),
  );
  const after = await readWallet();
  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    throw new Error(
      `${failures.length}/${concurrency} unlock requests failed: ${failures[0]?.status}`,
    );
  }

  const payloads = results.map((result) => result.data);
  const purchaseIds = new Set(payloads.map((item) => item.purchase.id));
  const transactionIds = new Set(
    payloads.map((item) => item.purchase.walletTransactionId),
  );
  if (purchaseIds.size !== 1 || transactionIds.size !== 1) {
    throw new Error(
      'Concurrent replay created more than one purchase/ledger transaction',
    );
  }
  const chargedResults = payloads.filter((item) => !item.alreadyOwned);
  const alreadyOwnedResults = payloads.filter((item) => item.alreadyOwned);
  if (
    chargedResults.length !== 1 ||
    alreadyOwnedResults.length !== concurrency - 1
  ) {
    throw new Error(
      `Expected one charge and ${concurrency - 1} already-owned responses, received ${chargedResults.length} and ${alreadyOwnedResults.length}`,
    );
  }

  const price = BigInt(payloads[0]?.purchase.creditPrice ?? '0');
  const actualDelta =
    BigInt(before.availableBalance) - BigInt(after.availableBalance);
  if (price <= 0n || actualDelta !== price) {
    throw new Error(
      `Wallet delta mismatch: expected ${price.toString()}, received ${actualDelta.toString()}`,
    );
  }

  const latencies = results
    .map((result) => result.durationMs)
    .sort((a, b) => a - b);
  const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1] ?? 0;
  const summary = {
    result: p95 <= maximumP95Ms ? 'pass' : 'fail',
    concurrency,
    p95Ms: Number(p95.toFixed(2)),
    maximumP95Ms,
    purchaseId: [...purchaseIds][0],
    chargedRequests: chargedResults.length,
    alreadyOwnedRequests: alreadyOwnedResults.length,
    walletDelta: actualDelta.toString(),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (p95 > maximumP95Ms) {
    throw new Error(`Unlock P95 ${p95.toFixed(2)}ms exceeds ${maximumP95Ms}ms`);
  }
}

async function readWallet(): Promise<{ availableBalance: string }> {
  const response = await fetch(`${baseUrl}/wallet/me`, {
    headers: authHeaders(),
  });
  const body = await parseJson<{ availableBalance: string }>(response);
  if (!response.ok)
    throw new Error(`Wallet read returned HTTP ${response.status}`);
  return body;
}

async function unlock(idempotencyKey: string): Promise<{
  ok: boolean;
  status: number;
  durationMs: number;
  data: {
    purchase: { id: string; walletTransactionId: string; creditPrice: string };
    replayed: boolean;
    alreadyOwned: boolean;
  };
}> {
  const started = performance.now();
  const response = await fetch(
    `${baseUrl}/monetization/chapters/${chapterId}/unlock`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'content-type': 'application/json',
        'x-idempotency-key': idempotencyKey,
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: '{}',
    },
  );
  const data = await parseJson<{
    purchase: { id: string; walletTransactionId: string; creditPrice: string };
    replayed: boolean;
    alreadyOwned: boolean;
  }>(response);
  return {
    ok: response.ok,
    status: response.status,
    durationMs: performance.now() - started,
    data,
  };
}

function authHeaders(): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

async function parseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T | { data: T };
  return 'data' in (value as object)
    ? (value as { data: T }).data
    : (value as T);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}
