import { Injectable } from '@nestjs/common';
import { AccessDeniedException } from '@/common/exceptions';
import { MediaPurpose } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';

@Injectable()
export class MediaOwnershipAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanCreate(
    userId: string,
    purpose: MediaPurpose,
    ownerId: string,
  ): Promise<void> {
    let allowed = false;
    if (purpose === MediaPurpose.AVATAR) allowed = ownerId === userId;
    else if (purpose === MediaPurpose.AUTHOR_BANNER) {
      allowed =
        ownerId === userId &&
        Boolean(
          await this.prisma.authorProfile.findUnique({
            where: { userId },
            select: { userId: true },
          }),
        );
    } else if (purpose === MediaPurpose.STORY_COVER) {
      allowed = Boolean(
        await this.prisma.story.findFirst({
          where: {
            id: ownerId,
            deletedAt: null,
            OR: [
              { authorId: userId },
              { contributors: { some: { userId, canEdit: true } } },
            ],
          },
          select: { id: true },
        }),
      );
    } else if (purpose === MediaPurpose.CHAPTER_IMAGE) {
      allowed = Boolean(
        await this.prisma.chapter.findFirst({
          where: {
            id: ownerId,
            deletedAt: null,
            story: {
              OR: [
                { authorId: userId },
                { contributors: { some: { userId, canEdit: true } } },
              ],
            },
          },
          select: { id: true },
        }),
      );
    } else if (purpose === MediaPurpose.ATTACHMENT) {
      const [story, chapter] = await Promise.all([
        this.prisma.story.findFirst({
          where: {
            id: ownerId,
            deletedAt: null,
            OR: [
              { authorId: userId },
              { contributors: { some: { userId, canEdit: true } } },
            ],
          },
          select: { id: true },
        }),
        this.prisma.chapter.findFirst({
          where: {
            id: ownerId,
            deletedAt: null,
            story: {
              OR: [
                { authorId: userId },
                { contributors: { some: { userId, canEdit: true } } },
              ],
            },
          },
          select: { id: true },
        }),
      ]);
      allowed = Boolean(story || chapter);
    }
    if (!allowed)
      throw new AccessDeniedException({
        message: 'Không có quyền quản lý media cho tài nguyên này',
      });
  }

  assertUploader(userId: string, uploaderId: string | null): void {
    if (uploaderId !== userId)
      throw new AccessDeniedException({
        message: 'Media không thuộc người dùng hiện tại',
      });
  }
}
