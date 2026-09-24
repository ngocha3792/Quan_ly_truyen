import { Prisma } from '@/generated/prisma/client';

export interface RevenuePosting {
  readonly account: string;
  readonly userId?: string | null;
  readonly amount: bigint;
}

// All financial writers acquire this lock before reading balances. PostgreSQL
// owns coordination across API and worker replicas; no process-local mutexes.
export async function lockRevenueLedger(tx: Prisma.TransactionClient) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('revenue-ledger'))`,
  );
}

export async function postRevenueJournal(
  tx: Prisma.TransactionClient,
  eventKey: string,
  rows: readonly RevenuePosting[],
) {
  const postings = rows.filter((row) => row.amount !== 0n);
  if (postings.reduce((sum, row) => sum + row.amount, 0n) !== 0n)
    throw new Error('Revenue postings must balance');
  if (!postings.length) return;
  await lockRevenueLedger(tx);
  const existing = await tx.revenueJournalEntry.findMany({
    where: { eventKey },
  });
  if (existing.length) {
    const canonical = (items: readonly RevenuePosting[]) =>
      items
        .map((item) => `${item.account}:${item.userId ?? ''}:${item.amount}`)
        .sort()
        .join('|');
    if (canonical(existing) !== canonical(postings))
      throw new Error('Revenue journal event conflicts with existing postings');
    return;
  }
  await tx.revenueJournalEntry.createMany({
    data: postings.map((row) => ({ eventKey, ...row })),
  });
}
