import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import {
  AuthorJobError,
  type StoredAuthorCharacter,
  type StoredAuthorIssue,
} from '../../application/author-tools/ai-author.types';
import { assertAuthorToolAccess, lockAuthorStory } from './ai-author-source';

@Injectable()
export class AiAuthorKnowledgePersistence {
  constructor(private readonly prisma: PrismaService) {}
  async characters(
    userId: string,
    storyId: string,
  ): Promise<StoredAuthorCharacter[]> {
    await assertAuthorToolAccess(this.prisma, userId, storyId);
    return (await this.prisma.storyCharacter.findMany({
      where: { storyId },
      orderBy: { name: 'asc' },
      take: 200,
    })) as unknown as StoredAuthorCharacter[];
  }
  async verifyCharacter(
    userId: string,
    storyId: string,
    id: string,
    isVerified: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockAuthorStory(tx, storyId);
      await assertAuthorToolAccess(tx, userId, storyId);
      const updated = await tx.storyCharacter.updateMany({
        where: { id, storyId },
        data: { isVerified },
      });
      if (!updated.count) throw new AuthorJobError('NOT_FOUND');
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ai.character.verified',
          entityType: 'StoryCharacter',
          entityId: id,
          metadata: { storyId, isVerified },
        },
      });
    });
  }
  async issues(
    userId: string,
    storyId: string,
    chapterId?: string,
  ): Promise<StoredAuthorIssue[]> {
    await assertAuthorToolAccess(this.prisma, userId, storyId);
    const issues = await this.prisma.chapterConsistencyIssue.findMany({
      where: { chapterId, chapter: { storyId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return issues.map((issue) => ({
      ...issue,
      suggestion: issue.suggestion ?? '',
    }));
  }
  async updateIssue(
    userId: string,
    storyId: string,
    id: string,
    patch: { isDismissed?: boolean; isResolved?: boolean },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockAuthorStory(tx, storyId);
      await assertAuthorToolAccess(tx, userId, storyId);
      const updated = await tx.chapterConsistencyIssue.updateMany({
        where: { id, chapter: { storyId, deletedAt: null } },
        data: patch,
      });
      if (!updated.count) throw new AuthorJobError('NOT_FOUND');
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ai.consistency.updated',
          entityType: 'ChapterConsistencyIssue',
          entityId: id,
          metadata: { storyId, ...patch },
        },
      });
    });
  }
}
