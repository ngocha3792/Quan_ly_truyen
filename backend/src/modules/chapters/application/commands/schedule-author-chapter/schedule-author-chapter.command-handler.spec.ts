import {
  ChapterNotSchedulableException,
  ChapterScheduleMustBeFutureException,
} from '../../../domain';
import { ScheduleAuthorChapterCommand } from './schedule-author-chapter.command';
import { ScheduleAuthorChapterCommandHandler } from './schedule-author-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('ScheduleAuthorChapterCommandHandler', () => {
  let persistence: { schedule: jest.Mock };
  let handler: ScheduleAuthorChapterCommandHandler;

  beforeEach(() => {
    persistence = { schedule: jest.fn() };
    handler = new ScheduleAuthorChapterCommandHandler(persistence as never);
  });

  it('schedules a chapter at a future instant', async () => {
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    persistence.schedule.mockResolvedValue({
      status: 'scheduled',
      chapter: chapterRecord(new Date(scheduledAt)),
    });

    const result = await handler.execute(command(scheduledAt));

    expect(persistence.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        storyId: STORY_ID,
        chapterId: CHAPTER_ID,
        scheduledAt: new Date(scheduledAt),
      }),
    );
    expect(result.status).toBe('SCHEDULED');
  });

  it('rejects a timestamp that is not in the future', async () => {
    await expect(
      handler.execute(command('2020-01-01T00:00:00.000Z')),
    ).rejects.toBeInstanceOf(ChapterScheduleMustBeFutureException);
    expect(persistence.schedule).not.toHaveBeenCalled();
  });

  it('maps a non-schedulable state to a domain conflict', async () => {
    persistence.schedule.mockResolvedValue({ status: 'not_schedulable' });
    await expect(
      handler.execute(command(new Date(Date.now() + 60_000).toISOString())),
    ).rejects.toBeInstanceOf(ChapterNotSchedulableException);
  });
});

function command(scheduledAt: string): ScheduleAuthorChapterCommand {
  return new ScheduleAuthorChapterCommand(
    USER_ID,
    STORY_ID,
    CHAPTER_ID,
    scheduledAt,
    undefined,
    undefined,
    'schedule-test',
  );
}

function chapterRecord(scheduledAt: Date) {
  const now = new Date();
  return {
    id: CHAPTER_ID,
    storyId: STORY_ID,
    createdById: USER_ID,
    updatedById: USER_ID,
    number: 1,
    title: 'Chương 1',
    slug: 'chuong-1',
    content: 'Nội dung',
    contentFormat: 'MARKDOWN',
    status: 'SCHEDULED',
    wordCount: 2,
    version: 1,
    scheduledAt,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
