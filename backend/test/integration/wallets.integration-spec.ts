import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import { WalletCurrency } from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import {
  PostWalletTransactionCommand,
  PostWalletTransactionCommandHandler,
  ReconcileWalletQuery,
  ReconcileWalletQueryHandler,
} from '@/modules/wallets';
import { PrismaWalletPersistence } from '@/modules/wallets/infrastructure';

describe('wallet ledger integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let postTransaction: PostWalletTransactionCommandHandler;
  let reconcile: ReconcileWalletQueryHandler;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [PrismaWalletPersistence],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    const persistence = moduleRef.get(PrismaWalletPersistence);
    postTransaction = new PostWalletTransactionCommandHandler(persistence);
    reconcile = new ReconcileWalletQueryHandler(persistence);
  });

  afterAll(async () => moduleRef?.close());

  it('posts a balanced credit exactly once and preserves the original replay result', async () => {
    const userId = await createUser('idempotent');
    const command = creditCommand(userId, 100n, 'idempotent-credit');

    const first = await postTransaction.execute(command);
    const replay = await postTransaction.execute(command);
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: {
        userId_currency: { userId, currency: WalletCurrency.CREDIT },
      },
      include: {
        ledgerEntries: true,
        transactions: true,
      },
    });

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(wallet.balance).toBe(100n);
    expect(wallet.version).toBe(1);
    expect(wallet.transactions).toHaveLength(1);
    expect(wallet.ledgerEntries).toHaveLength(1);
    const allEntries = await prisma.walletLedgerEntry.findMany({
      where: { transactionId: first.transaction.id },
    });
    expect(allEntries).toHaveLength(2);
    expect(allEntries.reduce((sum, entry) => sum + entry.amount, 0n)).toBe(0n);
  });

  it('rejects an idempotency key reused for a different financial request', async () => {
    const userId = await createUser('conflict');
    await postTransaction.execute(creditCommand(userId, 20n, 'same-key'));

    await expect(
      postTransaction.execute(creditCommand(userId, 30n, 'same-key')),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('serializes concurrent debits and never allows the balance below zero', async () => {
    const userId = await createUser('concurrency');
    await postTransaction.execute(creditCommand(userId, 100n, 'seed'));

    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        postTransaction.execute(
          new PostWalletTransactionCommand(
            userId,
            'CREDIT',
            'CHAPTER_PURCHASE',
            'DEBIT',
            10n,
            'PLATFORM_REVENUE',
            `chapter-purchase-${index}`,
            'chapter',
            randomUUID(),
          ),
        ),
      ),
    );
    const fulfilled = attempts.filter(
      (attempt) => attempt.status === 'fulfilled',
    );
    const rejected = attempts.filter(
      (attempt) => attempt.status === 'rejected',
    );
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: {
        userId_currency: { userId, currency: WalletCurrency.CREDIT },
      },
    });

    expect(fulfilled).toHaveLength(10);
    expect(rejected).toHaveLength(2);
    expect(
      rejected.every(
        (attempt) =>
          attempt.status === 'rejected' &&
          (attempt.reason as { code?: string }).code ===
            'WALLET_INSUFFICIENT_FUNDS',
      ),
    ).toBe(true);
    expect(wallet.balance).toBe(0n);
    expect(wallet.version).toBe(11);

    await expect(
      reconcile.execute(new ReconcileWalletQuery(userId)),
    ).resolves.toMatchObject({
      materializedBalance: '0',
      ledgerBalance: '0',
      transactionCount: 11,
      balancedTransactionCount: 11,
      isConsistent: true,
    });
  });

  it('rejects an unbalanced transaction at the deferred database constraint', async () => {
    const userId = await createUser('constraint');
    await postTransaction.execute(creditCommand(userId, 10n, 'valid-credit'));
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: {
        userId_currency: { userId, currency: WalletCurrency.CREDIT },
      },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.walletLedgerTransaction.create({
          data: {
            walletId: wallet.id,
            currency: WalletCurrency.CREDIT,
            type: 'ADMIN_ADJUSTMENT',
            idempotencyKey: `malformed-${randomUUID()}`,
            requestHash: '0'.repeat(64),
            referenceType: 'constraint-test',
            referenceId: randomUUID(),
            walletAmount: 1n,
            walletBalanceAfter: 11n,
            entries: {
              create: {
                walletId: wallet.id,
                currency: WalletCurrency.CREDIT,
                amount: 1n,
              },
            },
          },
        });
      }),
    ).rejects.toThrow();
  });

  async function createUser(label: string): Promise<string> {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `${label}-${suffix}@wallet.test`,
        username: `${label}-${suffix}`.slice(0, 50),
        displayName: `Wallet ${label}`,
      },
      select: { id: true },
    });
    return user.id;
  }
});

function creditCommand(
  userId: string,
  amount: bigint,
  suffix: string,
): PostWalletTransactionCommand {
  return new PostWalletTransactionCommand(
    userId,
    'CREDIT',
    'TOP_UP',
    'CREDIT',
    amount,
    'PAYMENT_CLEARING',
    `wallet-test-${suffix}`,
    'payment-order',
    `${suffix}-${randomUUID()}`,
  );
}
