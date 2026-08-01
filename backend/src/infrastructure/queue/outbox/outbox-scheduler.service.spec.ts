import { ConfigService } from '@nestjs/config';

import { DISPATCH_OUTBOX_BATCH_JOB } from '../contracts';
import {
  OUTBOX_SCHEDULER_ID,
  OutboxSchedulerService,
} from './outbox-scheduler.service';

describe('OutboxSchedulerService', () => {
  it('upserts one stable scheduler with configured interval and batch size', async () => {
    const queue = createQueue();
    const service = createService(queue);

    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      OUTBOX_SCHEDULER_ID,
      { every: 2345 },
      {
        name: DISPATCH_OUTBOX_BATCH_JOB,
        data: { version: 1, batchSize: 17 },
        opts: {
          removeOnComplete: { count: 10 },
          removeOnFail: { count: 50 },
        },
      },
    );
    expect(queue.getRepeatableJobs).not.toHaveBeenCalled();
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it('is safe when multiple instances register the same scheduler ID', async () => {
    const queue = createQueue();

    await Promise.all([
      createService(queue).onModuleInit(),
      createService(queue).onModuleInit(),
    ]);

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    const calls = queue.upsertJobScheduler.mock.calls as unknown as Array<
      [string, ...unknown[]]
    >;
    expect(calls.map(([schedulerId]) => schedulerId)).toEqual([
      OUTBOX_SCHEDULER_ID,
      OUTBOX_SCHEDULER_ID,
    ]);
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it('rejects bootstrap when scheduler registration fails', async () => {
    const queue = createQueue();
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis unavailable'));

    await expect(createService(queue).onModuleInit()).rejects.toThrow(
      'redis unavailable',
    );
  });

  it('does not register a scheduler when queues are disabled', async () => {
    const queue = createQueue();
    const service = createService(queue, false);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });
});

function createQueue() {
  return {
    upsertJobScheduler: jest.fn().mockResolvedValue({}),
    getRepeatableJobs: jest.fn(),
    removeRepeatableByKey: jest.fn(),
  };
}

function createService(
  queue: ReturnType<typeof createQueue>,
  enabled = true,
): OutboxSchedulerService {
  return new OutboxSchedulerService(
    new ConfigService({
      queue: {
        enabled,
        outboxBatchSize: 17,
        outboxPollIntervalMs: 2345,
      },
    }),
    queue as never,
  );
}
