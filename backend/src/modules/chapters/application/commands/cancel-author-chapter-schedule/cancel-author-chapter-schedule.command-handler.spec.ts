import { ChapterNotScheduledException } from '../../../domain';
import { CancelAuthorChapterScheduleCommand } from './cancel-author-chapter-schedule.command';
import { CancelAuthorChapterScheduleCommandHandler } from './cancel-author-chapter-schedule.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('CancelAuthorChapterScheduleCommandHandler', () => {
  it('returns the chapter to approved without discarding review', async () => {
    const now = new Date();
    const persistence = {
      cancelSchedule: jest.fn().mockResolvedValue({
        status: 'canceled',
        chapter: {
          id: CHAPTER_ID,
          storyId: STORY_ID,
          createdById: USER_ID,
          updatedById: USER_ID,
          number: 1,
          title: 'Chương 1',
          slug: 'chuong-1',
          content: 'Nội dung',
          contentFormat: 'MARKDOWN',
          status: 'APPROVED',
          wordCount: 2,
          version: 1,
          scheduledAt: null,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      }),
    };
    const handler = new CancelAuthorChapterScheduleCommandHandler(
      persistence as never,
    );

    const result = await handler.execute(command());

    expect(result.status).toBe('APPROVED');
    expect(persistence.cancelSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ chapterId: CHAPTER_ID, userId: USER_ID }),
    );
  });

  it('rejects a chapter that is not scheduled', async () => {
    const handler = new CancelAuthorChapterScheduleCommandHandler({
      cancelSchedule: jest.fn().mockResolvedValue({ status: 'not_scheduled' }),
    } as never);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      ChapterNotScheduledException,
    );
  });
});

function command(): CancelAuthorChapterScheduleCommand {
  return new CancelAuthorChapterScheduleCommand(
    USER_ID,
    STORY_ID,
    CHAPTER_ID,
    undefined,
    undefined,
    'cancel-schedule-test',
  );
}
