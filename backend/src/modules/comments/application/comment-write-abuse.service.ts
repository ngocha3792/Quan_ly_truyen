import { Injectable } from '@nestjs/common';
import { ModerationStatus } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { CommentDuplicateRecentException, CommentPolicy } from '../domain';
import { AbuseRateLimiterService } from './abuse-rate-limiter.service';

@Injectable()
export class CommentWriteAbuseService {
  constructor(
    private readonly prisma: PrismaService,
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
    const recent = await this.prisma.comment.findMany({
      where: {
        userId: input.userId,
        storyId: input.storyId,
        chapterId: input.chapterId ?? null,
        createdAt: { gte: from },
        deletedAt: null,
        moderationStatus: ModerationStatus.VISIBLE,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: { body: true },
    });
    const fingerprint = CommentPolicy.fingerprint(body);
    if (
      recent.some(
        (item) => CommentPolicy.fingerprint(item.body) === fingerprint,
      )
    ) {
      throw new CommentDuplicateRecentException();
    }
    return body;
  }
}
