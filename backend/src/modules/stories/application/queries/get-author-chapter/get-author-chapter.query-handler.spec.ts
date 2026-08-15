import { AuthenticationRequiredException } from '@/common/exceptions';

import { ChapterNotFoundException } from '../../../domain';
import { GetAuthorChapterQuery } from './get-author-chapter.query';
import { GetAuthorChapterQueryHandler } from './get-author-chapter.query-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('GetAuthorChapterQueryHandler', () => {
  let persistence: { findOwnedById: jest.Mock };
  let handler: GetAuthorChapterQueryHandler;

  beforeEach(() => {
    persistence = { findOwnedById: jest.fn() };
    handler = new GetAuthorChapterQueryHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(new GetAuthorChapterQuery(undefined, STORY_ID, CHAPTER_ID)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);
    expect(persistence.findOwnedById).not.toHaveBeenCalled();
  });

  it('trả 404 semantics khi chapter/story không thuộc author', async () => {
    persistence.findOwnedById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetAuthorChapterQuery(USER_ID, STORY_ID, CHAPTER_ID)),
    ).rejects.toBeInstanceOf(ChapterNotFoundException);
    expect(persistence.findOwnedById).toHaveBeenCalledWith(
      USER_ID,
      STORY_ID,
      CHAPTER_ID,
    );
  });
});
