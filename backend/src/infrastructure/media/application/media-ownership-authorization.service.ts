import { Injectable } from '@nestjs/common';

import { PermissionCode } from '@/common/enums';

import { AccessDeniedException } from '@/common/exceptions';

import type { AuthPrincipal } from '@/common/interfaces/auth';

import {
  AuthorApplicationStatus,
  MediaPurpose,
} from '@/generated/prisma/client';

import { PrismaService } from '@/infrastructure/database/prisma';

@Injectable()
export class MediaOwnershipAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanCreate(
    principal: AuthPrincipal,

    purpose: MediaPurpose,

    ownerId: string,
  ): Promise<void> {
    const userId = principal.userId;

    let allowed = false;

    if (purpose === MediaPurpose.AVATAR) {
      allowed = ownerId === userId;
    } else if (purpose === MediaPurpose.AUTHOR_BANNER) {
      allowed =
        ownerId === userId &&
        Boolean(
          await this.prisma.authorProfile.findUnique({
            where: {
              userId,
            },

            select: {
              userId: true,
            },
          }),
        );
    } else if (purpose === MediaPurpose.STORY_COVER) {
      allowed = Boolean(
        await this.prisma.story.findFirst({
          where: {
            id: ownerId,

            deletedAt: null,

            OR: [
              {
                authorId: userId,
              },

              {
                contributors: {
                  some: {
                    userId,

                    canEdit: true,
                  },
                },
              },
            ],
          },

          select: {
            id: true,
          },
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
                {
                  authorId: userId,
                },

                {
                  contributors: {
                    some: {
                      userId,

                      canEdit: true,
                    },
                  },
                },
              ],
            },
          },

          select: {
            id: true,
          },
        }),
      );
    } else if (purpose === MediaPurpose.GENRE_COVER) {
      allowed =
        principal.permissions.includes(PermissionCode.CATEGORY_MANAGE) ||
        principal.permissions.includes(PermissionCode.MEDIA_MANAGE_ANY);
    } else if (purpose === MediaPurpose.AUTHOR_APPLICATION_SAMPLE) {
      allowed = Boolean(
        await this.prisma.authorApplication.findFirst({
          where: {
            id: ownerId,

            userId,

            status: {
              in: [
                AuthorApplicationStatus.DRAFT,

                AuthorApplicationStatus.REJECTED,
              ],
            },
          },

          select: {
            id: true,
          },
        }),
      );
    } else if (purpose === MediaPurpose.ATTACHMENT) {
      const [story, chapter] = await Promise.all([
        this.prisma.story.findFirst({
          where: {
            id: ownerId,

            deletedAt: null,

            OR: [
              {
                authorId: userId,
              },

              {
                contributors: {
                  some: {
                    userId,

                    canEdit: true,
                  },
                },
              },
            ],
          },

          select: {
            id: true,
          },
        }),

        this.prisma.chapter.findFirst({
          where: {
            id: ownerId,

            deletedAt: null,

            story: {
              OR: [
                {
                  authorId: userId,
                },

                {
                  contributors: {
                    some: {
                      userId,

                      canEdit: true,
                    },
                  },
                },
              ],
            },
          },

          select: {
            id: true,
          },
        }),
      ]);

      allowed = Boolean(story || chapter);
    }

    if (!allowed) {
      throw new AccessDeniedException({
        message: 'Không có quyền quản lý media cho tài nguyên này',
      });
    }
  }

  assertUploader(
    principal: AuthPrincipal,

    uploaderId: string | null,
  ): void {
    if (uploaderId !== principal.userId) {
      throw new AccessDeniedException({
        message: 'Media không thuộc người dùng hiện tại',
      });
    }
  }

  assertCanDelete(
    principal: AuthPrincipal,

    uploaderId: string | null,
  ): void {
    if (
      uploaderId !== principal.userId &&
      !principal.permissions.includes(PermissionCode.MEDIA_MANAGE_ANY)
    ) {
      throw new AccessDeniedException({
        message: 'Không có quyền xóa media này',
      });
    }
  }
}
