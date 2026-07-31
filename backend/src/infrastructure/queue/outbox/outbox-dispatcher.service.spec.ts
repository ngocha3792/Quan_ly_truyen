/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';

import { OutboxStatus } from '@/generated/prisma/enums';

import { OutboxDispatcherService } from './outbox-dispatcher.service';

describe('OutboxDispatcherService', () => {
  let service: OutboxDispatcherService;
  let mockPrisma: {
    outboxEvent: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mockQueue: {
    add: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    mockPrisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    // Make $transaction call the callback with the prisma mock itself
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return cb(mockPrisma);
      },
    );

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue({
        enabled: true,
        prefix: 'qlt',
        defaultAttempts: 3,
        defaultBackoffMs: 5000,
        workerConcurrency: 5,
      }),
    };

    service = new OutboxDispatcherService(
      mockPrisma as any,
      mockConfigService as unknown as ConfigService,
      mockQueue as any,
    );
  });

  describe('dispatchBatch', () => {
    it('should return 0 when no pending events exist', async () => {
      mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

      const result = await service.dispatchBatch();

      expect(result).toBe(0);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should claim and publish pending events', async () => {
      const event = createMockEvent({
        id: 'evt-1',
        status: OutboxStatus.PENDING,
      });

      mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.dispatchBatch();

      expect(result).toBe(1);
      expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['evt-1'] },
            status: OutboxStatus.PENDING,
          }),
          data: { status: OutboxStatus.PROCESSING },
        }),
      );
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-1' },
          data: expect.objectContaining({
            status: OutboxStatus.PUBLISHED,
          }),
        }),
      );
    });

    it('should handle failure and retry when under max attempts', async () => {
      const event = createMockEvent({
        id: 'evt-2',
        status: OutboxStatus.PENDING,
        attempts: 0,
      });

      mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      mockQueue.add.mockRejectedValue(new Error('Connection refused'));

      const result = await service.dispatchBatch();

      expect(result).toBe(0);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-2' },
          data: expect.objectContaining({
            status: OutboxStatus.PENDING,
            attempts: 1,
            lastError: 'Connection refused',
          }),
        }),
      );
    });

    it('should mark as FAILED when max attempts reached', async () => {
      const event = createMockEvent({
        id: 'evt-3',
        status: OutboxStatus.PENDING,
        attempts: 2, // max is 3, next attempt = 3 >= maxAttempts
      });

      mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      mockQueue.add.mockRejectedValue(new Error('Queue down'));

      const result = await service.dispatchBatch();

      expect(result).toBe(0);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-3' },
          data: expect.objectContaining({
            status: OutboxStatus.FAILED,
            attempts: 3,
            lastError: 'Queue down',
          }),
        }),
      );
    });

    it('should process multiple events and continue on individual failure', async () => {
      const event1 = createMockEvent({
        id: 'evt-a',
        status: OutboxStatus.PENDING,
      });
      const event2 = createMockEvent({
        id: 'evt-b',
        status: OutboxStatus.PENDING,
      });

      mockPrisma.outboxEvent.findMany.mockResolvedValue([event1, event2]);
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 2 });

      // First succeeds, second fails
      mockQueue.add
        .mockResolvedValueOnce({ id: 'job-a' })
        .mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.dispatchBatch();

      expect(result).toBe(1);
      // evt-a should be published
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-a' },
          data: expect.objectContaining({
            status: OutboxStatus.PUBLISHED,
          }),
        }),
      );
      // evt-b should be retried
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-b' },
          data: expect.objectContaining({
            status: OutboxStatus.PENDING,
            attempts: 1,
          }),
        }),
      );
    });

    it('should truncate long error messages', async () => {
      const event = createMockEvent({
        id: 'evt-long',
        status: OutboxStatus.PENDING,
        attempts: 0,
      });

      mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

      const longError = new Error('x'.repeat(1000));
      mockQueue.add.mockRejectedValue(longError);

      await service.dispatchBatch();

      const updateCall = mockPrisma.outboxEvent.update.mock.calls[0] as [
        { data: { lastError: string } },
      ];
      expect(updateCall[0].data.lastError.length).toBeLessThanOrEqual(500);
    });
  });
});

function createMockEvent(
  overrides: Partial<{
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
    status: OutboxStatus;
    attempts: number;
    availableAt: Date;
    processedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'evt-default',
    aggregateType: overrides.aggregateType ?? 'story',
    aggregateId: overrides.aggregateId ?? 'story-123',
    eventType: overrides.eventType ?? 'story.published',
    payload: overrides.payload ?? { storyId: 'story-123' },
    status: overrides.status ?? OutboxStatus.PENDING,
    attempts: overrides.attempts ?? 0,
    availableAt: overrides.availableAt ?? new Date('2026-01-01T00:00:00Z'),
    processedAt: overrides.processedAt ?? null,
    lastError: overrides.lastError ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
  };
}
