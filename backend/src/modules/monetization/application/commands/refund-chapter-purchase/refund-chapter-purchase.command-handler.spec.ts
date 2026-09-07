import type {
  MonetizationPersistencePort,
  RefundChapterPurchaseInput,
  RefundChapterPurchaseRecord,
} from '../../ports';
import { RefundChapterPurchaseCommand } from './refund-chapter-purchase.command';
import { RefundChapterPurchaseCommandHandler } from './refund-chapter-purchase.command-handler';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PURCHASE_ID = '22222222-2222-4222-8222-222222222222';

describe('RefundChapterPurchaseCommandHandler', () => {
  let capturedInput: RefundChapterPurchaseInput | undefined;
  const refundResult: RefundChapterPurchaseRecord = {
    purchase: {
      id: PURCHASE_ID,
      chapterId: '33333333-3333-4333-8333-333333333333',
      storyId: '44444444-4444-4444-8444-444444444444',
      storySlug: 'truyen-thu',
      storyTitle: 'Truyện thử',
      chapterNumber: 3,
      chapterTitle: 'Chương ba',
      creditPrice: 25n,
      status: 'REFUNDED',
      walletTransactionId: '55555555-5555-4555-8555-555555555555',
      refundWalletTransactionId: '66666666-6666-4666-8666-666666666666',
      refundReason: 'Giao dịch bị tính nhầm theo yêu cầu hỗ trợ',
      refundedAt: new Date('2026-09-07T12:00:00.000Z'),
      entitlementId: '77777777-7777-4777-8777-777777777777',
      createdAt: new Date('2026-09-07T10:00:00.000Z'),
    },
    walletBalance: 125n,
    replayed: false,
  };
  const refundChapterPurchase = jest.fn(
    (
      input: RefundChapterPurchaseInput,
    ): Promise<RefundChapterPurchaseRecord> => {
      capturedInput = input;
      return Promise.resolve(refundResult);
    },
  );
  const persistence = {
    refundChapterPurchase,
  } as unknown as MonetizationPersistencePort;
  const handler = new RefundChapterPurchaseCommandHandler(persistence);

  beforeEach(() => {
    jest.clearAllMocks();
    capturedInput = undefined;
  });

  it('normalizes the reason and builds a deterministic request hash', async () => {
    const result = await handler.execute(
      new RefundChapterPurchaseCommand(
        ACTOR_ID,
        PURCHASE_ID,
        '  Giao dịch bị tính nhầm theo yêu cầu hỗ trợ  ',
        'refund-request-001',
      ),
    );

    expect(result.walletBalance).toBe('125');
    expect(result.purchase.status).toBe('REFUNDED');
    expect(capturedInput?.actorId).toBe(ACTOR_ID);
    expect(capturedInput?.purchaseId).toBe(PURCHASE_ID);
    expect(capturedInput?.reason).toBe(
      'Giao dịch bị tính nhầm theo yêu cầu hỗ trợ',
    );
    expect(capturedInput?.requestHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('rejects a support reason that is too short', async () => {
    await expect(
      handler.execute(
        new RefundChapterPurchaseCommand(
          ACTOR_ID,
          PURCHASE_ID,
          'ngắn',
          'refund-request-002',
        ),
      ),
    ).rejects.toThrow('Lý do hoàn');
    expect(refundChapterPurchase).not.toHaveBeenCalled();
  });
});
