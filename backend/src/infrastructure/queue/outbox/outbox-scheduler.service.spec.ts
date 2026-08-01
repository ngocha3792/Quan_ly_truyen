import { ConfigService } from '@nestjs/config';

import { DISPATCH_OUTBOX_BATCH_JOB } from '../contracts';
import { OutboxSchedulerService } from './outbox-scheduler.service';

describe('OutboxSchedulerService', () => {
  it('uses configured batch size and poll interval', async () => {
    const queue = {
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn(),
      add: jest.fn().mockResolvedValue({}),
    };
    const service = new OutboxSchedulerService(
      new ConfigService({
        queue: {
          enabled: true,
          outboxBatchSize: 17,
          outboxPollIntervalMs: 2345,
        },
      }),
      queue as never,
    );
    await service.onModuleInit();
    expect(queue.add).toHaveBeenCalledWith(
      DISPATCH_OUTBOX_BATCH_JOB,
      { version: 1, batchSize: 17 },
      expect.objectContaining({ repeat: { every: 2345 } }),
    );
  });
});
