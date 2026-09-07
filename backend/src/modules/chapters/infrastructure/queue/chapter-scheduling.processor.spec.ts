import { PUBLISH_SCHEDULED_CHAPTERS_JOB } from '@/infrastructure/queue/contracts';

import type { PublishDueScheduledChaptersInput } from '../../application';

import { ChapterSchedulingProcessor } from './chapter-scheduling.processor';

describe('ChapterSchedulingProcessor', () => {
  it('publishes one due batch through the persistence port', async () => {
    const publishDueScheduled = jest
      .fn<Promise<number>, [PublishDueScheduledChaptersInput]>()
      .mockResolvedValue(2);
    const persistence = {
      publishDueScheduled,
    };
    const propagation = {
      runWithQueueContext: jest.fn(
        async (_metadata, _context, callback: () => Promise<number>) =>
          callback(),
      ),
    };
    const processor = new ChapterSchedulingProcessor(
      persistence as never,
      propagation as never,
    );

    const result = await processor.process({
      id: 'schedule-job-1',
      name: PUBLISH_SCHEDULED_CHAPTERS_JOB,
      data: { version: 1, batchSize: 25 },
    } as never);

    expect(result).toBe(2);
    expect(publishDueScheduled).toHaveBeenCalledWith({
      dueAt: publishDueScheduled.mock.calls[0][0].dueAt,
      batchSize: 25,
      requestId: 'schedule-job-1',
    });
    expect(publishDueScheduled.mock.calls[0][0].dueAt).toBeInstanceOf(Date);
  });

  it('ignores unknown jobs on the reserved queue', async () => {
    const persistence = { publishDueScheduled: jest.fn() };
    const processor = new ChapterSchedulingProcessor(
      persistence as never,
      {} as never,
    );

    await expect(
      processor.process({ id: 'unknown', name: 'unknown', data: {} } as never),
    ).resolves.toBe(0);
    expect(persistence.publishDueScheduled).not.toHaveBeenCalled();
  });
});
