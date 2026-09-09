import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COMMENT_ABUSE_GUARD_PORT,
  type CommentAbuseGuardPort,
  type CommentWriteGuardPort,
} from '../../application/ports';
import { CommentDuplicateRecentException, CommentPolicy } from '../../domain';
import {
  RECENT_COMMENT_READER_PORT,
  type RecentCommentReaderPort,
} from '../../application/ports';

@Injectable()
export class CommentWriteGuardAdapter implements CommentWriteGuardPort {
  constructor(
    @Inject(RECENT_COMMENT_READER_PORT)
    private readonly recentComments: RecentCommentReaderPort,
    @Inject(COMMENT_ABUSE_GUARD_PORT)
    private readonly limiter: CommentAbuseGuardPort,
    private readonly config: ConfigService,
  ) {}

  validateBody(value: string): string {
    const body = CommentPolicy.validateBody(value, this.limiter.maxLinks);
    CommentPolicy.assertNotBlacklisted(
      body,
      (this.config.get<string>('COMMENT_BLACKLIST_TERMS') ?? '').split(
        /[,;\n]/,
      ),
    );
    return body;
  }

  async prepare(input: {
    userId: string;
    storyId: string;
    chapterId?: string | null;
    anchorBlockId?: string;
    body: string;
    ipAddress?: string;
  }): Promise<string> {
    const body = this.validateBody(input.body);
    await this.limiter.consume('comment-write', input.userId, input.ipAddress, {
      chapterId: input.chapterId,
      anchorBlockId: input.anchorBlockId,
    });

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
