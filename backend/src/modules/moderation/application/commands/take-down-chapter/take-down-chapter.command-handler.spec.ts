import {
  ContentTakedownPurchasesExistException,
  InvalidTakedownReasonException,
  TakedownChapterNotFoundException,
} from '../../../domain';
import { TakeDownChapterCommand } from './take-down-chapter.command';
import { TakeDownChapterCommandHandler } from './take-down-chapter.command-handler';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const REASON = 'Xuất bản nhầm bản thảo chưa biên tập';

describe('TakeDownChapterCommandHandler', () => {
  let persistence: { takeDownChapter: jest.Mock; takeDownStory: jest.Mock };
  let handler: TakeDownChapterCommandHandler;

  beforeEach(() => {
    persistence = { takeDownChapter: jest.fn(), takeDownStory: jest.fn() };
    handler = new TakeDownChapterCommandHandler(persistence);
  });

  it('gửi lý do đã chuẩn hóa, cờ xác nhận và audit context xuống persistence', async () => {
    persistence.takeDownChapter.mockResolvedValue({
      status: 'taken_down',
      chapterId: CHAPTER_ID,
      storyId: STORY_ID,
      number: '12',
      title: 'Chương 12',
      purchaseCount: 0,
    });

    const outcome = await handler.execute(
      new TakeDownChapterCommand(
        ACTOR_ID,
        CHAPTER_ID,
        `  ${REASON}   nữa  `,
        true,
        { ipAddress: '127.0.0.1', userAgent: 'Jest', requestId: 'req-1' },
      ),
    );

    expect(persistence.takeDownChapter).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      chapterId: CHAPTER_ID,
      reason: `${REASON} nữa`,
      acknowledgePurchases: true,
      takenDownAt: expect.any(Date) as unknown,
      audit: { ipAddress: '127.0.0.1', userAgent: 'Jest', requestId: 'req-1' },
    });
    expect(outcome).toEqual({
      chapterId: CHAPTER_ID,
      storyId: STORY_ID,
      number: '12',
      title: 'Chương 12',
      purchaseCount: 0,
    });
  });

  it('từ chối lý do quá ngắn trước khi chạm vào dữ liệu', async () => {
    await expect(
      handler.execute(createCommand({ reason: 'nhầm' })),
    ).rejects.toBeInstanceOf(InvalidTakedownReasonException);

    expect(persistence.takeDownChapter).not.toHaveBeenCalled();
  });

  it('chặn khi chương đã có người mua mà admin chưa xác nhận', async () => {
    persistence.takeDownChapter.mockResolvedValue({
      status: 'purchases_exist',
      purchaseCount: 7,
    });

    await expect(handler.execute(createCommand({}))).rejects.toBeInstanceOf(
      ContentTakedownPurchasesExistException,
    );
  });

  it('báo not found khi chương không tồn tại hoặc đã bị gỡ', async () => {
    persistence.takeDownChapter.mockResolvedValue({ status: 'not_found' });

    await expect(handler.execute(createCommand({}))).rejects.toBeInstanceOf(
      TakedownChapterNotFoundException,
    );
  });
});

function createCommand(
  overrides: Partial<{ reason: string; acknowledgePurchases: boolean }>,
): TakeDownChapterCommand {
  return new TakeDownChapterCommand(
    ACTOR_ID,
    CHAPTER_ID,
    overrides.reason ?? REASON,
    overrides.acknowledgePurchases ?? false,
    {},
  );
}
