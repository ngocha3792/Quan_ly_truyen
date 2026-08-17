import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import type { RecentCommentReaderPort } from '../../application';

@Injectable()
export class PrismaRecentCommentReader implements RecentCommentReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async findRecentBodies(input: {
    readonly userId: string;
    readonly storyId: string;
    readonly chapterId: string | null;
    readonly from: Date;
    readonly limit: number;
  }): Promise<readonly string[]> {
    const rows = await this.prisma.comment.findMany({
      where: {
        userId: input.userId,
        storyId: input.storyId,
        chapterId: input.chapterId,
        createdAt: { gte: input.from },
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
      select: { body: true },
    });
    return rows.map((item) => item.body);
  }
}
