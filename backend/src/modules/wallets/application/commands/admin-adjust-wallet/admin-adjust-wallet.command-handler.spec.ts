import {
  PostWalletTransactionCommand,
  type PostWalletTransactionCommandHandler,
} from '../post-wallet-transaction';
import { AdminAdjustWalletCommand } from './admin-adjust-wallet.command';
import { AdminAdjustWalletCommandHandler } from './admin-adjust-wallet.command-handler';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('AdminAdjustWalletCommandHandler', () => {
  let capturedCommand: PostWalletTransactionCommand | undefined;
  const execute = jest.fn((command: PostWalletTransactionCommand) => {
    capturedCommand = command;
    return Promise.resolve({
      transaction: {
        id: 'tx-1',
        currency: 'CREDIT' as const,
        type: 'ADMIN_ADJUSTMENT' as const,
        direction: 'DEBIT' as const,
        amount: '40',
        balanceAfter: '60',
        referenceType: 'admin_adjustment',
        referenceId: 'reference-1',
        createdAt: '2026-09-07T12:00:00.000Z',
      },
      replayed: false,
    });
  });
  const postTransaction = { execute };
  const handler = new AdminAdjustWalletCommandHandler(
    postTransaction as unknown as PostWalletTransactionCommandHandler,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCommand = undefined;
  });

  it('posts an audited double-entry admin adjustment', async () => {
    await handler.execute(
      new AdminAdjustWalletCommand(
        ACTOR_ID,
        USER_ID,
        'DEBIT',
        '40',
        'Điều chỉnh theo ticket hỗ trợ SUP-100',
        'adjustment-request-001',
        '127.0.0.1',
        'jest',
        'request-1',
      ),
    );

    const command = capturedCommand;
    expect(command?.userId).toBe(USER_ID);
    expect(command?.type).toBe('ADMIN_ADJUSTMENT');
    expect(command?.direction).toBe('DEBIT');
    expect(command?.amount).toBe(40n);
    expect(command?.systemAccount).toBe('ADJUSTMENT');
    expect(command?.referenceType).toBe('admin_adjustment');
    expect(command?.metadata?.['actorId']).toBe(ACTOR_ID);
    expect(command?.audit).toMatchObject({
      actorId: ACTOR_ID,
      reason: 'Điều chỉnh theo ticket hỗ trợ SUP-100',
      requestId: 'request-1',
    });
    expect(command?.idempotencyKey).toMatch(/^admin-adjustment:[0-9a-f]{64}$/u);
  });

  it('requires a meaningful audit reason', () => {
    expect(() =>
      handler.execute(
        new AdminAdjustWalletCommand(
          ACTOR_ID,
          USER_ID,
          'CREDIT',
          '10',
          'sai',
          'adjustment-request-002',
        ),
      ),
    ).toThrow('Lý do điều chỉnh');
  });
});
