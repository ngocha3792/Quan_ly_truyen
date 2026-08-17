import { Inject, Injectable } from '@nestjs/common';
import { CommentDuplicateRecentException, CommentPolicy } from '../domain';
import { AbuseRateLimiterService } from './abuse-rate-limiter.service';
import {
  RECENT_COMMENT_READER_PORT,
  type RecentCommentReaderPort,
} from './ports';

@Injectable()
export class CommentWriteAbuseService {
  constructor(
    @Inject(RECENT_COMMENT_READER_PORT)
    private readonly recentComments: RecentCommentReaderPort,
    private readonly limiter: AbuseRateLimiterService,
  ) {}

  async prepare(input: {
    userId: string;
    storyId: string;
    chapterId?: string | null;
    body: string;
    ipAddress?: string;
  }): Promise<string> {
    const body = CommentPolicy.validateBody(input.body, this.limiter.maxLinks);
    await this.limiter.consume('comment-write', input.userId, input.ipAddress);

    const from = new Date(
      Date.now() - this.limiter.duplicateWindowSeconds * 1000,
    );
    const recentBodies = await this.recentComments.findRecentBodies({
      userId: input.userId,
      storyId: input.storyId,
      chapterId: input.chapterId ?? null,
      from,
      limit: 20,
    });
    const fingerprint = CommentPolicy.fingerprint(body);
    if (
      recentBodies.some(
        (item) => CommentPolicy.fingerprint(item) === fingerprint,
      )
    ) {
      throw new CommentDuplicateRecentException();
    }
    return body;
  }
}
