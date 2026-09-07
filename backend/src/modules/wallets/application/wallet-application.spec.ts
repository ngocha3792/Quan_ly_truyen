import { randomUUID } from 'node:crypto';

import type { WalletPersistencePort } from './ports';
import {
  GetMyWalletQuery,
  GetMyWalletQueryHandler,
  ListMyWalletTransactionsQuery,
  ListMyWalletTransactionsQueryHandler,
  PostWalletTransactionCommand,
  PostWalletTransactionCommandHandler,
  ReconcileWalletQuery,
  ReconcileWalletQueryHandler,
} from './index';

describe('wallet application', () => {
  const userId = randomUUID();
  let persistence: jest.Mocked<WalletPersistencePort>;

  beforeEach(() => {
    persistence = {
      findBalance: jest.fn(),
      listTransactions: jest.fn(),
      postTransaction: jest.fn(),
      reconcile: jest.fn(),
    };
  });

  it('returns a string balance without exposing bigint through the API DTO', async () => {
    persistence.findBalance.mockResolvedValue({
      userId,
      currency: 'CREDIT',
      balance: 125n,
      version: 2,
      updatedAt: new Date('2026-09-07T10:00:00.000Z'),
    });
    const handler = new GetMyWalletQueryHandler(persistence);

    await expect(
      handler.execute(new GetMyWalletQuery(userId)),
    ).resolves.toEqual({
      currency: 'CREDIT',
      availableBalance: '125',
      version: 2,
      updatedAt: '2026-09-07T10:00:00.000Z',
    });
  });

  it('normalizes and hashes an internal credit command before persistence', async () => {
    persistence.postTransaction.mockImplementation((input) =>
      Promise.resolve({
        replayed: false,
        transaction: {
          id: randomUUID(),
          currency: input.currency,
          type: input.type,
          walletAmount: input.walletAmount,
          walletBalanceAfter: 40n,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          createdAt: new Date('2026-09-07T10:00:00.000Z'),
        },
      }),
    );
    const handler = new PostWalletTransactionCommandHandler(persistence);

    const result = await handler.execute(
      new PostWalletTransactionCommand(
        userId,
        'CREDIT',
        'TOP_UP',
        'CREDIT',
        40n,
        'PAYMENT_CLEARING',
        '  payment-event-001  ',
        ' payment-order ',
        ' order-001 ',
      ),
    );

    const persisted = persistence.postTransaction.mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      walletAmount: 40n,
      idempotencyKey: 'payment-event-001',
      referenceType: 'payment-order',
      referenceId: 'order-001',
    });
    expect(persisted?.requestHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.transaction).toMatchObject({
      direction: 'CREDIT',
      amount: '40',
      balanceAfter: '40',
    });
  });

  it('rejects non-positive amounts before touching persistence', async () => {
    const handler = new PostWalletTransactionCommandHandler(persistence);

    await expect(
      handler.execute(
        new PostWalletTransactionCommand(
          userId,
          'CREDIT',
          'CHAPTER_PURCHASE',
          'DEBIT',
          0n,
          'PLATFORM_REVENUE',
          'chapter-purchase-001',
          'chapter',
          randomUUID(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'WALLET_TRANSACTION_INVALID' });
    expect(persistence.postTransaction.mock.calls).toHaveLength(0);
  });

  it('rejects amounts beyond the bounded Credit range', async () => {
    const handler = new PostWalletTransactionCommandHandler(persistence);

    await expect(
      handler.execute(
        new PostWalletTransactionCommand(
          userId,
          'CREDIT',
          'TOP_UP',
          'CREDIT',
          9_000_000_000_000_001n,
          'PAYMENT_CLEARING',
          'oversized-credit-001',
          'payment-order',
          randomUUID(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'WALLET_TRANSACTION_INVALID' });
    expect(persistence.postTransaction.mock.calls).toHaveLength(0);
  });

  it('maps transaction history and reconciliation without bigint JSON values', async () => {
    persistence.listTransactions.mockResolvedValue({
      items: [
        {
          id: randomUUID(),
          currency: 'CREDIT',
          type: 'CHAPTER_PURCHASE',
          walletAmount: -15n,
          walletBalanceAfter: 25n,
          referenceType: 'chapter',
          referenceId: randomUUID(),
          createdAt: new Date('2026-09-07T11:00:00.000Z'),
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    persistence.reconcile.mockResolvedValue({
      userId,
      currency: 'CREDIT',
      materializedBalance: 25n,
      ledgerBalance: 25n,
      transactionCount: 2,
      balancedTransactionCount: 2,
    });

    const history = await new ListMyWalletTransactionsQueryHandler(
      persistence,
    ).execute(new ListMyWalletTransactionsQuery(userId, 1, 20));
    const reconciliation = await new ReconcileWalletQueryHandler(
      persistence,
    ).execute(new ReconcileWalletQuery(userId));

    expect(history.items[0]).toMatchObject({
      direction: 'DEBIT',
      amount: '15',
      balanceAfter: '25',
    });
    expect(reconciliation).toMatchObject({
      materializedBalance: '25',
      ledgerBalance: '25',
      isConsistent: true,
    });
  });
});
