import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';

import type {
  AuthorDashboardProfileRecord,
  AuthorPersistencePort,
  AuthorProfileAggregateRecord,
  AuthorProfileDetailRecord,
  AuthorProfileListRecord,
  AuthorProfileNewRecord,
  DailyStatRecord,
  DashboardCommentRecord,
  DashboardStoryRecord,
  DraftChapterRecord,
  RecentChapterRecord,
  ScheduledChapterRecord,
} from '../../application/ports';

const PUBLIC_STORY_STATUSES = ['PUBLISHED', 'HIATUS', 'COMPLETED'] as const;

const PUBLIC_AUTHOR_WHERE = {
  verificationStatus: 'VERIFIED' as const,
  user: {
    is: {
      status: 'ACTIVE' as const,
      deletedAt: null,
    },
  },
};

@Injectable()
export class PrismaAuthorPersistence implements AuthorPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findDirectoryAuthors(): Promise<readonly AuthorProfileListRecord[]> {
    return this.prisma.authorProfile.findMany({
      where: PUBLIC_AUTHOR_WHERE,
      select: {
        userId: true,
        penName: true,
        slug: true,
        biography: true,
        verificationStatus: true,
        featuredRank: true,
        followerCount: true,
        totalReadCount: true,
        storyCount: true,
        stories: {
          where: {
            status: { in: [...PUBLIC_STORY_STATUSES] },
            visibility: 'PUBLIC',
            deletedAt: null,
          },
          orderBy: { viewCount: 'desc' },
          take: 1,
          select: {
            categories: {
              orderBy: { isPrimary: 'desc' },
              take: 1,
              select: {
                category: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ followerCount: 'desc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }

  async findNewAuthors(
    limit: number,
  ): Promise<readonly AuthorProfileNewRecord[]> {
    return this.prisma.authorProfile.findMany({
      where: PUBLIC_AUTHOR_WHERE,
      select: {
        userId: true,
        penName: true,
        slug: true,
        verificationStatus: true,
        storyCount: true,
        totalReadCount: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async aggregateDirectoryStats(): Promise<AuthorProfileAggregateRecord> {
    const aggregate = await this.prisma.authorProfile.aggregate({
      where: PUBLIC_AUTHOR_WHERE,
      _count: { _all: true },
      _sum: {
        storyCount: true,
        totalReadCount: true,
        followerCount: true,
      },
    });

    return {
      totalAuthors: aggregate._count._all,
      totalStories: aggregate._sum.storyCount ?? 0,
      totalReads: aggregate._sum.totalReadCount ?? 0n,
      totalFollowers: aggregate._sum.followerCount ?? 0,
    };
  }

  async findAuthorBySlug(
    slug: string,
  ): Promise<AuthorProfileDetailRecord | null> {
    return this.prisma.authorProfile.findFirst({
      where: {
        slug,
        verificationStatus: 'VERIFIED',
        user: {
          is: {
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
      },
      select: {
        userId: true,
        penName: true,
        slug: true,
        biography: true,
        socialLinks: true,
        verificationStatus: true,
        verifiedAt: true,
        followerCount: true,
        totalReadCount: true,
        storyCount: true,
        createdAt: true,
        user: {
          select: {
            displayName: true,
          },
        },
        stories: {
          where: {
            status: { in: [...PUBLIC_STORY_STATUSES] },
            visibility: 'PUBLIC',
            deletedAt: null,
          },
          orderBy: { viewCount: 'desc' },
          take: 20,
          select: {
            id: true,
            slug: true,
            title: true,
            synopsis: true,
            viewCount: true,
            chapterCount: true,
            ratingAverage: true,
            ratingCount: true,
            publishedAt: true,
            categories: {
              orderBy: { isPrimary: 'desc' },
              select: {
                category: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findRecentChaptersByAuthor(
    authorId: string,
    limit: number,
  ): Promise<readonly RecentChapterRecord[]> {
    return this.prisma.chapter.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        story: {
          is: {
            authorId,
            status: { in: [...PUBLIC_STORY_STATUSES] },
            visibility: 'PUBLIC',
            deletedAt: null,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        number: true,
        title: true,
        publishedAt: true,
        updatedAt: true,
        story: {
          select: { title: true },
        },
      },
    });
  }

  async findDashboardProfile(
    userId: string,
  ): Promise<AuthorDashboardProfileRecord | null> {
    return this.prisma.authorProfile.findUnique({
      where: { userId },
      select: {
        penName: true,
        verificationStatus: true,
        followerCount: true,
        user: {
          select: {
            displayName: true,
            avatarMedia: {
              select: {
                secureUrl: true,
                publicUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async findDashboardStories(
    userId: string,
  ): Promise<readonly DashboardStoryRecord[]> {
    return this.prisma.story.findMany({
      where: {
        authorId: userId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        viewCount: true,
        chapterCount: true,
        updatedAt: true,
        coverMedia: {
          select: {
            secureUrl: true,
            publicUrl: true,
          },
        },
        categories: {
          orderBy: { isPrimary: 'desc' },
          select: {
            category: {
              select: { name: true },
            },
          },
        },
      },
    });
  }

  async findDraftChapters(
    userId: string,
    limit: number,
  ): Promise<readonly DraftChapterRecord[]> {
    return this.prisma.chapter.findMany({
      where: {
        status: 'DRAFT',
        deletedAt: null,
        story: { is: { authorId: userId, deletedAt: null } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        wordCount: true,
        updatedAt: true,
        story: { select: { title: true } },
      },
    });
  }

  async findScheduledChapters(
    userId: string,
    limit: number,
  ): Promise<readonly ScheduledChapterRecord[]> {
    return this.prisma.chapter.findMany({
      where: {
        scheduledAt: { not: null },
        deletedAt: null,
        story: { is: { authorId: userId, deletedAt: null } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        scheduledAt: true,
        story: {
          select: {
            title: true,
            coverMedia: {
              select: {
                secureUrl: true,
                publicUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async findRecentComments(
    userId: string,
    limit: number,
  ): Promise<readonly DashboardCommentRecord[]> {
    return this.prisma.comment.findMany({
      where: {
        moderationStatus: 'VISIBLE',
        deletedAt: null,
        story: { is: { authorId: userId, deletedAt: null } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: {
          select: {
            displayName: true,
            avatarMedia: {
              select: {
                secureUrl: true,
                publicUrl: true,
              },
            },
          },
        },
        story: { select: { title: true } },
      },
    });
  }

  async findDailyStats(
    userId: string,
    from: Date,
  ): Promise<readonly DailyStatRecord[]> {
    return this.prisma.storyDailyStat.findMany({
      where: {
        date: { gte: from },
        story: { is: { authorId: userId } },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        viewCount: true,
      },
    });
  }

  async countUnreadNotifications(userId: string, now: Date): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }

  async countPublishedChaptersThisMonth(
    userId: string,
    from: Date,
  ): Promise<number> {
    return this.prisma.chapter.count({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: from },
        deletedAt: null,
        story: { is: { authorId: userId } },
      },
    });
  }
}
