import { ConfigService } from '@nestjs/config';

import { CHAPTER_SCHEDULING_SCHEDULER_ID } from './chapter-scheduling.scheduler';
import { ChapterSchedulingScheduler } from './chapter-scheduling.scheduler';

describe('ChapterSchedulingScheduler', () => {
  it('registers one stable repeatable recovery job', async () => {
    const queue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn().mockReturnValue({
        enabled: true,
        chapterSchedulingBatchSize: 25,
        chapterSchedulingPollIntervalMs: 12_000,
      }),
    } as unknown as ConfigService;
    const scheduler = new ChapterSchedulingScheduler(config, queue as never);

    await scheduler.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      CHAPTER_SCHEDULING_SCHEDULER_ID,
      { every: 12_000 },
      expect.objectContaining({
        data: { version: 1, batchSize: 25 },
      }),
    );
  });
});
