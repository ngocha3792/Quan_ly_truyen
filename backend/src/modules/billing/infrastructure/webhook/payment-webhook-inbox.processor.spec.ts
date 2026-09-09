import { PaymentOrderStatus } from '@/generated/prisma/client';
import { PaymentWebhookInboxProcessor } from './payment-webhook-inbox.processor';

describe('PaymentWebhookInboxProcessor expiration safety', () => {
  it('never auto-expires AWAITING_REVIEW orders', async () => {
    const paymentOrderUpdateMany = jest.fn((input: unknown) => {
      void input;
      return Promise.resolve({ count: 0 });
    });
    const prisma = {
      paymentOrder: { updateMany: paymentOrderUpdateMany },
      inboundWebhookEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const processor = new PaymentWebhookInboxProcessor(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {
        webhookBatchSize: 100,
        webhookMaxAttempts: 5,
        webhookRetryBaseMs: 100,
      } as never,
      {} as never,
    );
    await processor.processBatch();
    const firstCall: unknown = paymentOrderUpdateMany.mock.calls[0]?.[0];
    expect(firstCall).toMatchObject({
      where: {
        status: {
          in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.PENDING],
        },
      },
      data: {
        status: PaymentOrderStatus.EXPIRED,
        failureCode: 'ORDER_EXPIRED',
      },
    });
  });
});
