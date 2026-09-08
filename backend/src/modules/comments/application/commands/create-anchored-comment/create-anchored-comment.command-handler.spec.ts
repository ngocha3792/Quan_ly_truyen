import { CreateAnchoredCommentCommand } from './create-anchored-comment.command';
import { CreateAnchoredCommentCommandHandler } from './create-anchored-comment.command-handler';

const command = new CreateAnchoredCommentCommand(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  'Bình luận',
  {
    startBlockId: '44444444-4444-4444-8444-444444444444',
    startOffset: 0,
    endBlockId: '44444444-4444-4444-8444-444444444444',
    endOffset: 12,
    quoteText: 'Đoạn được chọn',
  },
  '127.0.0.1',
);

describe('CreateAnchoredCommentCommandHandler', () => {
  const abuse = { prepare: jest.fn().mockResolvedValue('Bình luận') };
  const metrics = { recordOperation: jest.fn() };

  it('fails closed while the feature flag is disabled', async () => {
    const handler = new CreateAnchoredCommentCommandHandler(
      {} as never,
      abuse,
      metrics,
      { inlineCommentsEnabled: false } as never,
    );
    await expect(handler.execute(command)).rejects.toMatchObject({
      code: 'READER_INLINE_COMMENTS_DISABLED',
    });
  });

  it('maps a server-side invalid range to the public anchor error', async () => {
    const persistence = {
      createAnchoredComment: jest
        .fn()
        .mockResolvedValue({ status: 'invalid_anchor' }),
    };
    const handler = new CreateAnchoredCommentCommandHandler(
      persistence as never,
      abuse,
      metrics,
      { inlineCommentsEnabled: true } as never,
    );
    await expect(handler.execute(command)).rejects.toMatchObject({
      code: 'COMMENT_ANCHOR_INVALID',
    });
  });
});
