import {
  ContentTakedownPurchasesExistException,
  InvalidTakedownReasonException,
  TakedownStoryNotFoundException,
} from '../../../domain';
import { TakeDownStoryCommand } from './take-down-story.command';
import { TakeDownStoryCommandHandler } from './take-down-story.command-handler';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const REASON = 'Truyện bị xuất bản nhầm khi chưa duyệt bản quyền';

describe('TakeDownStoryCommandHandler', () => {
  let persistence: { takeDownChapter: jest.Mock; takeDownStory: jest.Mock };
  let handler: TakeDownStoryCommandHandler;

  beforeEach(() => {
    persistence = { takeDownChapter: jest.fn(), takeDownStory: jest.fn() };
    handler = new TakeDownStoryCommandHandler(persistence);
  });

  it('gỡ truyện và trả về số chương bị gỡ theo', async () => {
    persistence.takeDownStory.mockResolvedValue({
      status: 'taken_down',
      storyId: STORY_ID,
      title: 'Truyện thử',
      slug: 'truyen-thu',
      chapterCount: 4,
      purchaseCount: 0,
    });

    const outcome = await handler.execute(
      new TakeDownStoryCommand(ACTOR_ID, STORY_ID, REASON, false, {}),
    );

    expect(persistence.takeDownStory).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      storyId: STORY_ID,
      reason: REASON,
      acknowledgePurchases: false,
      takenDownAt: expect.any(Date) as unknown,
      audit: {},
    });
    expect(outcome).toEqual({
      storyId: STORY_ID,
      title: 'Truyện thử',
      slug: 'truyen-thu',
      chapterCount: 4,
      purchaseCount: 0,
    });
  });

  it('từ chối lý do quá ngắn trước khi chạm vào dữ liệu', async () => {
    await expect(
      handler.execute(
        new TakeDownStoryCommand(ACTOR_ID, STORY_ID, 'nhầm', false, {}),
      ),
    ).rejects.toBeInstanceOf(InvalidTakedownReasonException);

    expect(persistence.takeDownStory).not.toHaveBeenCalled();
  });

  it('chặn khi truyện đã có người mua chương mà admin chưa xác nhận', async () => {
    persistence.takeDownStory.mockResolvedValue({
      status: 'purchases_exist',
      purchaseCount: 3,
    });

    await expect(
      handler.execute(
        new TakeDownStoryCommand(ACTOR_ID, STORY_ID, REASON, false, {}),
      ),
    ).rejects.toBeInstanceOf(ContentTakedownPurchasesExistException);
  });

  it('báo not found khi truyện không tồn tại hoặc đã bị gỡ', async () => {
    persistence.takeDownStory.mockResolvedValue({ status: 'not_found' });

    await expect(
      handler.execute(
        new TakeDownStoryCommand(ACTOR_ID, STORY_ID, REASON, false, {}),
      ),
    ).rejects.toBeInstanceOf(TakedownStoryNotFoundException);
  });
});
