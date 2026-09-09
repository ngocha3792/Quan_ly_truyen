import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import { ResourceNotFoundException } from '@/common/exceptions';
import type {
  ChapterEditSessionPort,
  ChapterEditSessionRecord,
} from '../../application/ports/chapter-workflow.port';
import { ChapterNotFoundException } from '../../domain';
import { lockAndFindEditableStory } from './chapter-edit-access';

const SESSION_LIFETIME_MS = 90_000;
const include = { user: { select: { displayName: true } } } as const;

@Injectable()
export class PrismaChapterEditSessionPersistence implements ChapterEditSessionPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    storyId: string,
    chapterId: string,
  ): Promise<readonly ChapterEditSessionRecord[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, userId, storyId, chapterId);
      const now = new Date();
      await tx.chapterEditSession.deleteMany({
        where: { chapterId, expiresAt: { lte: now } },
      });
      const rows = await tx.chapterEditSession.findMany({
        where: { chapterId, expiresAt: { gt: now } },
        include,
        orderBy: { lastHeartbeatAt: 'desc' },
        take: 50,
      });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.user.displayName,
        tabId: row.activeTabId,
        expiresAt: row.expiresAt,
        lastHeartbeatAt: row.lastHeartbeatAt,
      }));
    });
  }

  async save(
    userId: string,
    storyId: string,
    chapterId: string,
    tabId: string,
    token?: string,
  ): Promise<ChapterEditSessionRecord> {
    return this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, userId, storyId, chapterId);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
      await tx.chapterEditSession.deleteMany({
        where: { chapterId, expiresAt: { lte: now } },
      });
      if (token) {
        const result = await tx.chapterEditSession.updateMany({
          where: {
            chapterId,
            userId,
            sessionToken: token,
            activeTabId: tabId,
            expiresAt: { gt: now },
          },
          data: { lastHeartbeatAt: now, expiresAt },
        });
        if (!result.count)
          throw new ResourceNotFoundException({
            code: 'CHAPTER_EDIT_SESSION_EXPIRED',
            resource: 'phiên chỉnh sửa',
            message: 'Phiên chỉnh sửa đã hết hạn',
          });
      }
      const row = token
        ? await tx.chapterEditSession.findUniqueOrThrow({
            where: { sessionToken: token },
            include,
          })
        : await tx.chapterEditSession.upsert({
            where: {
              chapterId_userId_activeTabId: {
                chapterId,
                userId,
                activeTabId: tabId,
              },
            },
            create: {
              chapterId,
              userId,
              activeTabId: tabId,
              sessionToken: randomBytes(32).toString('hex'),
              expiresAt,
              lastHeartbeatAt: now,
            },
            update: { expiresAt, lastHeartbeatAt: now },
            include,
          });
      return {
        id: row.id,
        userId,
        displayName: row.user.displayName,
        tabId,
        expiresAt: row.expiresAt,
        lastHeartbeatAt: row.lastHeartbeatAt,
        sessionToken: row.sessionToken,
      };
    });
  }

  async remove(
    userId: string,
    storyId: string,
    chapterId: string,
    token: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const story = await lockAndFindEditableStory(tx, storyId, userId);
      if (!story) throw new ChapterNotFoundException();
      await tx.chapterEditSession.deleteMany({
        where: { chapterId, chapter: { storyId }, userId, sessionToken: token },
      });
    });
  }

  private async authorize(
    tx: Parameters<typeof lockAndFindEditableStory>[0],
    userId: string,
    storyId: string,
    chapterId: string,
  ) {
    const story = await lockAndFindEditableStory(tx, storyId, userId);
    if (!story || story.status === 'PENDING_REVIEW')
      throw new ChapterNotFoundException();
    const chapter = await tx.chapter.findFirst({
      where: { id: chapterId, storyId, deletedAt: null, status: 'DRAFT' },
      select: { id: true },
    });
    if (!chapter) throw new ChapterNotFoundException();
  }
}
