import type { ConfigService } from '@nestjs/config';
import type {
  CommentAbuseGuardPort,
  RecentCommentReaderPort,
} from '../../application/ports';
import { CommentWriteGuardAdapter } from './comment-write-guard.adapter';

describe('CommentWriteGuardAdapter', () => {
  const consume = jest.fn();
  const limiter: jest.Mocked<CommentAbuseGuardPort> = {
    consume,
    maxLinks: 3,
    duplicateWindowSeconds: 300,
  };
  const recent: jest.Mocked<RecentCommentReaderPort> = {
    findRecentBodies: jest.fn(),
  };
  const config = {
    get: () => 'buy now,blocked phrase',
  } as unknown as ConfigService;
  const guard = new CommentWriteGuardAdapter(recent, limiter, config);

  beforeEach(() => {
    limiter.consume.mockReset().mockResolvedValue(undefined);
    recent.findRecentBodies.mockReset().mockResolvedValue([]);
  });

  it('blocks creation and edit validation with the same configured blacklist', async () => {
    await expect(
      guard.prepare({
        userId: 'user',
        storyId: 'story',
        chapterId: 'chapter',
        anchorBlockId: 'block',
        body: 'BUY NOW!',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_BLACKLISTED_CONTENT' });
    expect(() => guard.validateBody('blocked phrase')).toThrow();
    expect(consume).not.toHaveBeenCalled();
  });

  it('passes the inherited anchor to the limiter and retains duplicate detection', async () => {
    const input = {
      userId: 'user',
      storyId: 'story',
      chapterId: 'chapter',
      anchorBlockId: 'block',
      body: 'A thoughtful reply',
    };
    await expect(guard.prepare(input)).resolves.toBe(input.body);
    expect(consume).toHaveBeenCalledWith('comment-write', 'user', undefined, {
      chapterId: 'chapter',
      anchorBlockId: 'block',
    });
    recent.findRecentBodies.mockResolvedValue(['a  thoughtful reply']);
    await expect(guard.prepare(input)).rejects.toMatchObject({
      code: 'COMMENT_DUPLICATE_RECENT',
    });
  });
});
