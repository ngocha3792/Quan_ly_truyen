import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';

export interface AuthorDirectoryViewResponse {
  readonly authors: readonly AuthorDirectoryItemResponse[];
  readonly statistics: {
    readonly authors: string;
    readonly works: string;
    readonly reads: string;
    readonly followers: string;
  };
  readonly newAuthors: readonly NewAuthorItemResponse[];
}

interface AuthorDirectoryItemResponse {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly initials: string;
  readonly genre: string;
  readonly description: string;
  readonly verified: boolean;
  readonly worksLabel: string;
  readonly readsLabel: string;
  readonly followersLabel: string;
  readonly works: number;
  readonly reads: number;
  readonly followers: number;
  readonly featuredRank: number;
}

interface NewAuthorItemResponse {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly initials: string;
  readonly worksLabel: string;
  readonly readsLabel: string;
  readonly verified: boolean;
}

export interface AuthorDetailViewResponse {
  readonly profile: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly initials: string;
    readonly headline: string;
    readonly country: string;
    readonly penName: string;
    readonly joinedAt: string;
    readonly verified: boolean;
    readonly biography: readonly string[];
  };
  readonly statistics: {
    readonly totalWorks: number;
    readonly followers: string;
    readonly totalReads: string;
    readonly averageRating: string;
  };
  readonly featuredWorks: readonly AuthorWorkResponse[];
  readonly timeline: readonly {
    readonly year: string;
    readonly title: string;
    readonly description: string;
  }[];
  readonly recentUpdates: readonly {
    readonly id: string;
    readonly workTitle: string;
    readonly chapterTitle: string;
    readonly updatedAt: string;
  }[];
  readonly hotWorks: readonly {
    readonly rank: number;
    readonly title: string;
    readonly genre: string;
    readonly reads: string;
    readonly tone: AuthorWorkTone;
  }[];
}

type AuthorWorkTone = 'blue' | 'gold' | 'violet' | 'crimson' | 'cyan';

interface AuthorWorkResponse {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly genres: readonly string[];
  readonly chapters: number;
  readonly rating: string;
  readonly reads: string;
  readonly tone: AuthorWorkTone;
}

export interface AuthorStudioDashboardResponse {
  readonly profile: {
    readonly displayName: string;
    readonly penName: string;
    readonly avatarUrl: string;
    readonly level: number;
    readonly currentExperience: number;
    readonly requiredExperience: number;
    readonly verified: boolean;
  };
  readonly unreadNotifications: number;
  readonly metrics: readonly {
    readonly id: string;
    readonly title: string;
    readonly value: string;
    readonly trendValue: string;
    readonly trendLabel: string;
    readonly trendDirection: 'up' | 'down';
    readonly icon: 'book' | 'draft' | 'clock' | 'eye' | 'users';
    readonly tone: 'purple' | 'blue' | 'orange' | 'indigo' | 'pink';
  }[];
  readonly readership: Readonly<
    Record<'7d' | '30d' | '90d', readonly ReadershipChartPointResponse[]>
  >;
  readonly schedule: readonly PublicationScheduleItemResponse[];
  readonly stories: readonly AuthorStudioStoryResponse[];
  readonly drafts: readonly AuthorStudioDraftResponse[];
  readonly comments: readonly AuthorReaderCommentResponse[];
  readonly topStories: readonly AuthorTopStoryResponse[];
  readonly monthlyGoals: readonly AuthorMonthlyGoalResponse[];
}

interface ReadershipChartPointResponse {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

interface PublicationScheduleItemResponse {
  readonly id: string;
  readonly weekday: string;
  readonly date: string;
  readonly storyTitle: string;
  readonly chapterTitle: string;
  readonly time: string;
  readonly status: 'scheduled' | 'published' | 'pending' | 'draft';
  readonly statusLabel: string;
  readonly coverUrl: string;
}

interface AuthorStudioStoryResponse {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly coverUrl: string;
  readonly genres: readonly string[];
  readonly status: 'publishing' | 'paused' | 'completed';
  readonly statusLabel: string;
  readonly latestChapter: number;
  readonly updatedAt: string;
}

interface AuthorStudioDraftResponse {
  readonly id: string;
  readonly storyTitle: string;
  readonly chapterTitle: string;
  readonly updatedAt: string;
  readonly completionPercent: number;
}

interface AuthorReaderCommentResponse {
  readonly id: string;
  readonly readerName: string;
  readonly avatarUrl: string;
  readonly storyTitle: string;
  readonly content: string;
  readonly createdAt: string;
  readonly unread: boolean;
}

interface AuthorTopStoryResponse {
  readonly id: string;
  readonly rank: number;
  readonly title: string;
  readonly coverUrl: string;
  readonly views: string;
}

interface AuthorMonthlyGoalResponse {
  readonly id: string;
  readonly label: string;
  readonly currentValue: string;
  readonly targetValue: string;
  readonly progress: number;
  readonly icon: 'book' | 'eye';
  readonly tone: 'purple' | 'indigo';
}

const PUBLIC_STORY_STATUSES = ['PUBLISHED', 'HIATUS', 'COMPLETED'] as const;
const WORK_TONES: readonly AuthorWorkTone[] = ['blue', 'gold', 'cyan', 'violet', 'crimson'];
const EMPTY_COVER_URL = '/assets/images/story-cover-placeholder.svg';
const EMPTY_AVATAR_URL = '/assets/images/avatar-placeholder.svg';

@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDirectory(): Promise<AuthorDirectoryViewResponse> {
    const publicAuthorWhere = {
      verificationStatus: 'VERIFIED' as const,
      user: {
        is: {
          status: 'ACTIVE' as const,
          deletedAt: null,
        },
      },
    };

    const [authors, newAuthors, aggregate] = await Promise.all([
      this.prisma.authorProfile.findMany({
        where: publicAuthorWhere,
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
      }),
      this.prisma.authorProfile.findMany({
        where: publicAuthorWhere,
        select: {
          userId: true,
          penName: true,
          slug: true,
          verificationStatus: true,
          storyCount: true,
          totalReadCount: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.authorProfile.aggregate({
        where: publicAuthorWhere,
        _count: { _all: true },
        _sum: {
          storyCount: true,
          totalReadCount: true,
          followerCount: true,
        },
      }),
    ]);

    const sortedAuthors = [...authors].sort((first, second) => {
      const firstRank = first.featuredRank ?? Number.MAX_SAFE_INTEGER;
      const secondRank = second.featuredRank ?? Number.MAX_SAFE_INTEGER;

      return firstRank - secondRank || second.followerCount - first.followerCount;
    });

    return {
      authors: sortedAuthors.map((author, index) => {
        const genre = author.stories[0]?.categories[0]?.category.name ?? 'Đa thể loại';
        const reads = this.safeNumber(author.totalReadCount);

        return {
          id: author.userId,
          slug: author.slug,
          name: author.penName,
          initials: this.initials(author.penName),
          genre,
          description: this.summary(author.biography),
          verified: author.verificationStatus === 'VERIFIED',
          worksLabel: this.formatCompact(author.storyCount),
          readsLabel: this.formatCompact(author.totalReadCount),
          followersLabel: this.formatCompact(author.followerCount),
          works: author.storyCount,
          reads,
          followers: author.followerCount,
          featuredRank: author.featuredRank ?? 10_000 + index,
        };
      }),
      statistics: {
        authors: this.formatCompact(aggregate._count._all),
        works: this.formatCompact(aggregate._sum.storyCount ?? 0),
        reads: this.formatCompact(aggregate._sum.totalReadCount ?? 0n),
        followers: this.formatCompact(aggregate._sum.followerCount ?? 0),
      },
      newAuthors: newAuthors.map((author) => ({
        id: author.userId,
        slug: author.slug,
        name: author.penName,
        initials: this.initials(author.penName),
        worksLabel: this.formatCompact(author.storyCount),
        readsLabel: this.formatCompact(author.totalReadCount),
        verified: author.verificationStatus === 'VERIFIED',
      })),
    };
  }

  async getDetail(slug: string): Promise<AuthorDetailViewResponse> {
    const author = await this.prisma.authorProfile.findFirst({
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

    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const recentChapters = await this.prisma.chapter.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        story: {
          is: {
            authorId: author.userId,
            status: { in: [...PUBLIC_STORY_STATUSES] },
            visibility: 'PUBLIC',
            deletedAt: null,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
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

    const mainGenre = author.stories[0]?.categories[0]?.category.name ?? 'TruyenHub';
    const weightedRating = this.weightedAverageRating(author.stories);
    const socialLinks = this.asRecord(author.socialLinks);
    const firstPublishedStory = [...author.stories]
      .filter((story) => story.publishedAt !== null)
      .sort(
        (first, second) =>
          first.publishedAt!.getTime() - second.publishedAt!.getTime(),
      )[0];

    const timeline = [
      {
        year: String(author.createdAt.getFullYear()),
        title: 'Gia nhập TruyenHub',
        description: `${author.penName} bắt đầu hoạt động trên nền tảng.`,
      },
      ...(firstPublishedStory?.publishedAt
        ? [
            {
              year: String(firstPublishedStory.publishedAt.getFullYear()),
              title: firstPublishedStory.title,
              description: 'Tác phẩm công khai đầu tiên trên TruyenHub.',
            },
          ]
        : []),
      ...(author.verifiedAt
        ? [
            {
              year: String(author.verifiedAt.getFullYear()),
              title: 'Tác giả đã xác minh',
              description: 'Hồ sơ tác giả được TruyenHub xác minh.',
            },
          ]
        : []),
    ];

    return {
      profile: {
        id: author.userId,
        slug: author.slug,
        name: author.penName,
        initials: this.initials(author.penName),
        headline: `Tác giả ${mainGenre.toLocaleLowerCase('vi')} trên TruyenHub`,
        country: this.stringValue(socialLinks['country']) ?? 'Không công khai',
        penName: author.penName,
        joinedAt: String(author.createdAt.getFullYear()),
        verified: author.verificationStatus === 'VERIFIED',
        biography: this.biography(author.biography),
      },
      statistics: {
        totalWorks: author.storyCount,
        followers: this.formatCompact(author.followerCount),
        totalReads: this.formatCompact(author.totalReadCount),
        averageRating: `${weightedRating.toFixed(1)}/10`,
      },
      featuredWorks: author.stories.slice(0, 4).map((story, index) => ({
        id: story.id,
        slug: story.slug,
        title: story.title,
        description: story.synopsis,
        genres: story.categories.map((category) => category.category.name),
        chapters: story.chapterCount,
        rating: Number(story.ratingAverage.toString()).toFixed(1),
        reads: this.formatCompact(story.viewCount),
        tone: WORK_TONES[index % WORK_TONES.length]!,
      })),
      timeline,
      recentUpdates: recentChapters.map((chapter) => ({
        id: chapter.id,
        workTitle: chapter.story.title,
        chapterTitle: `Chương ${this.chapterNumber(chapter.number)}: ${chapter.title}`,
        updatedAt: this.formatDate(chapter.publishedAt ?? chapter.updatedAt),
      })),
      hotWorks: author.stories.slice(0, 5).map((story, index) => ({
        rank: index + 1,
        title: story.title,
        genre: story.categories[0]?.category.name ?? 'Đa thể loại',
        reads: this.formatCompact(story.viewCount),
        tone: WORK_TONES[index % WORK_TONES.length]!,
      })),
    };
  }

  async getDashboard(userId: string | undefined): Promise<AuthorStudioDashboardResponse> {
    const authenticatedUserId = this.requireUserId(userId);
    const now = new Date();
    const start90Days = this.startOfDay(this.addDays(now, -89));
    const start30Days = this.startOfDay(this.addDays(now, -29));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [profile, stories, draftChapters, scheduledChapters, comments, dailyStats, unreadNotifications, publishedThisMonth] =
      await Promise.all([
        this.prisma.authorProfile.findUnique({
          where: { userId: authenticatedUserId },
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
        }),
        this.prisma.story.findMany({
          where: {
            authorId: authenticatedUserId,
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
        }),
        this.prisma.chapter.findMany({
          where: {
            status: 'DRAFT',
            deletedAt: null,
            story: { is: { authorId: authenticatedUserId, deletedAt: null } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 4,
          select: {
            id: true,
            title: true,
            wordCount: true,
            updatedAt: true,
            story: { select: { title: true } },
          },
        }),
        this.prisma.chapter.findMany({
          where: {
            scheduledAt: { not: null },
            deletedAt: null,
            story: { is: { authorId: authenticatedUserId, deletedAt: null } },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 4,
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
        }),
        this.prisma.comment.findMany({
          where: {
            moderationStatus: 'VISIBLE',
            deletedAt: null,
            story: { is: { authorId: authenticatedUserId, deletedAt: null } },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
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
        }),
        this.prisma.storyDailyStat.findMany({
          where: {
            date: { gte: start90Days },
            story: { is: { authorId: authenticatedUserId } },
          },
          orderBy: { date: 'asc' },
          select: {
            date: true,
            viewCount: true,
          },
        }),
        this.prisma.notification.count({
          where: {
            userId: authenticatedUserId,
            readAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        }),
        this.prisma.chapter.count({
          where: {
            status: 'PUBLISHED',
            publishedAt: { gte: monthStart },
            deletedAt: null,
            story: { is: { authorId: authenticatedUserId } },
          },
        }),
      ]);

    if (!profile) {
      throw new NotFoundException('Author profile not found');
    }

    const publishedStories = stories.filter((story) =>
      PUBLIC_STORY_STATUSES.includes(
        story.status as (typeof PUBLIC_STORY_STATUSES)[number],
      ),
    );
    const currentDrafts = stories.filter((story) => story.status === 'DRAFT').length;
    const totalChapters = stories.reduce((sum, story) => sum + story.chapterCount, 0);
    const pendingChapters = scheduledChapters.filter(
      (chapter) => chapter.status === 'SCHEDULED',
    ).length;
    const views30Days = dailyStats
      .filter((stat) => stat.date >= start30Days)
      .reduce((sum, stat) => sum + this.safeNumber(stat.viewCount), 0);

    const directTrend = {
      trendValue: 'Trực tiếp',
      trendLabel: 'từ hệ thống',
      trendDirection: 'up' as const,
    };

    return {
      profile: {
        displayName: profile.user.displayName,
        penName: profile.penName,
        avatarUrl: this.mediaUrl(profile.user.avatarMedia) ?? EMPTY_AVATAR_URL,
        level: Math.floor(totalChapters / 50) + 1,
        currentExperience: totalChapters % 50,
        requiredExperience: 50,
        verified: profile.verificationStatus === 'VERIFIED',
      },
      unreadNotifications,
      metrics: [
        {
          id: 'published-stories',
          title: 'Truyện đang xuất bản',
          value: this.formatCompact(publishedStories.length),
          ...directTrend,
          icon: 'book',
          tone: 'purple',
        },
        {
          id: 'drafts',
          title: 'Bản nháp',
          value: this.formatCompact(currentDrafts + draftChapters.length),
          ...directTrend,
          icon: 'draft',
          tone: 'blue',
        },
        {
          id: 'pending-chapters',
          title: 'Chương đã lên lịch',
          value: this.formatCompact(pendingChapters),
          ...directTrend,
          icon: 'clock',
          tone: 'orange',
        },
        {
          id: 'views',
          title: 'Lượt xem 30 ngày',
          value: this.formatCompact(views30Days),
          ...directTrend,
          icon: 'eye',
          tone: 'indigo',
        },
        {
          id: 'followers',
          title: 'Người theo dõi',
          value: this.formatCompact(profile.followerCount),
          ...directTrend,
          icon: 'users',
          tone: 'pink',
        },
      ],
      readership: {
        '7d': this.buildReadershipPoints(dailyStats, now, 7),
        '30d': this.buildReadershipPoints(dailyStats, now, 30),
        '90d': this.buildReadershipPoints(dailyStats, now, 90),
      },
      schedule: scheduledChapters.map((chapter) => {
        const scheduledAt = chapter.scheduledAt!;
        const status = this.scheduleStatus(chapter.status);

        return {
          id: chapter.id,
          weekday: this.weekdayLabel(scheduledAt),
          date: this.formatShortDate(scheduledAt),
          storyTitle: chapter.story.title,
          chapterTitle: `Chương ${this.chapterNumber(chapter.number)}: ${chapter.title}`,
          time: this.formatTime(scheduledAt),
          status: status.value,
          statusLabel: status.label,
          coverUrl: this.mediaUrl(chapter.story.coverMedia) ?? EMPTY_COVER_URL,
        };
      }),
      stories: stories.slice(0, 8).map((story) => {
        const status = this.studioStoryStatus(story.status);

        return {
          id: story.id,
          slug: story.slug,
          title: story.title,
          coverUrl: this.mediaUrl(story.coverMedia) ?? EMPTY_COVER_URL,
          genres: story.categories.map((category) => category.category.name),
          status: status.value,
          statusLabel: status.label,
          latestChapter: story.chapterCount,
          updatedAt: this.formatDate(story.updatedAt),
        };
      }),
      drafts: draftChapters.map((chapter) => ({
        id: chapter.id,
        storyTitle: chapter.story.title,
        chapterTitle: chapter.title,
        updatedAt: this.formatDateTime(chapter.updatedAt),
        completionPercent: this.draftCompletion(chapter.wordCount),
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        readerName: comment.user.displayName,
        avatarUrl: this.mediaUrl(comment.user.avatarMedia) ?? EMPTY_AVATAR_URL,
        storyTitle: comment.story.title,
        content: comment.body,
        createdAt: this.formatRelativeDate(comment.createdAt, now),
        unread: false,
      })),
      topStories: [...stories]
        .sort((first, second) => this.compareBigInt(second.viewCount, first.viewCount))
        .slice(0, 3)
        .map((story, index) => ({
          id: story.id,
          rank: index + 1,
          title: story.title,
          coverUrl: this.mediaUrl(story.coverMedia) ?? EMPTY_COVER_URL,
          views: this.formatCompact(story.viewCount),
        })),
      monthlyGoals: [
        {
          id: 'goal-chapters',
          label: 'Chương xuất bản',
          currentValue: String(publishedThisMonth),
          targetValue: String(this.nextGoalTarget(publishedThisMonth, 10)),
          progress: this.progress(
            publishedThisMonth,
            this.nextGoalTarget(publishedThisMonth, 10),
          ),
          icon: 'book',
          tone: 'purple',
        },
        {
          id: 'goal-views',
          label: 'Lượt xem',
          currentValue: this.formatCompact(views30Days),
          targetValue: this.formatCompact(this.nextGoalTarget(views30Days, 10_000)),
          progress: this.progress(
            views30Days,
            this.nextGoalTarget(views30Days, 10_000),
          ),
          icon: 'eye',
          tone: 'indigo',
        },
      ],
    };
  }

  private buildReadershipPoints(
    stats: readonly { readonly date: Date; readonly viewCount: bigint }[],
    now: Date,
    days: number,
  ): readonly ReadershipChartPointResponse[] {
    const byDate = new Map<string, number>();

    for (const stat of stats) {
      const key = this.dateKey(stat.date);
      byDate.set(key, (byDate.get(key) ?? 0) + this.safeNumber(stat.viewCount));
    }

    return Array.from({ length: days }, (_, index) => {
      const date = this.startOfDay(this.addDays(now, index - days + 1));
      const key = this.dateKey(date);

      return {
        id: `${days}d-${key}`,
        label: this.formatShortDate(date),
        value: byDate.get(key) ?? 0,
      };
    });
  }

  private weightedAverageRating(
    stories: readonly {
      readonly ratingAverage: { toString(): string };
      readonly ratingCount: number;
    }[],
  ): number {
    const totalRatings = stories.reduce((sum, story) => sum + story.ratingCount, 0);

    if (totalRatings === 0) return 0;

    return (
      stories.reduce(
        (sum, story) =>
          sum + Number(story.ratingAverage.toString()) * story.ratingCount,
        0,
      ) / totalRatings
    );
  }

  private scheduleStatus(status: string): {
    readonly value: PublicationScheduleItemResponse['status'];
    readonly label: string;
  } {
    switch (status) {
      case 'PUBLISHED':
        return { value: 'published', label: 'Đã xuất bản' };
      case 'SCHEDULED':
        return { value: 'scheduled', label: 'Đã lên lịch' };
      case 'PENDING_REVIEW':
        return { value: 'pending', label: 'Chờ duyệt' };
      default:
        return { value: 'draft', label: 'Bản nháp' };
    }
  }

  private studioStoryStatus(status: string): {
    readonly value: AuthorStudioStoryResponse['status'];
    readonly label: string;
  } {
    switch (status) {
      case 'COMPLETED':
        return { value: 'completed', label: 'Hoàn thành' };
      case 'PUBLISHED':
        return { value: 'publishing', label: 'Đang cập nhật' };
      default:
        return { value: 'paused', label: 'Chưa xuất bản' };
    }
  }

  private draftCompletion(wordCount: number): number {
    return Math.min(100, Math.max(5, Math.round((wordCount / 2_000) * 100)));
  }

  private nextGoalTarget(current: number, step: number): number {
    return Math.max(step, (Math.floor(current / step) + 1) * step);
  }

  private progress(current: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  }

  private mediaUrl(
    media:
      | {
          readonly secureUrl: string | null;
          readonly publicUrl: string | null;
        }
      | null,
  ): string | null {
    return media?.secureUrl ?? media?.publicUrl ?? null;
  }

  private summary(value: string | null): string {
    if (!value?.trim()) {
      return 'Tác giả chưa cập nhật phần giới thiệu.';
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
  }

  private biography(value: string | null): readonly string[] {
    if (!value?.trim()) {
      return ['Tác giả chưa cập nhật tiểu sử.'];
    }

    const paragraphs = value
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    return paragraphs.length > 0 ? paragraphs : [value.trim()];
  }

  private initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase('vi');

    return `${words[0]![0] ?? ''}${words[words.length - 1]![0] ?? ''}`.toLocaleUpperCase('vi');
  }

  private formatCompact(value: bigint | number): string {
    const numericValue = typeof value === 'bigint' ? Number(value) : value;

    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numericValue);
  }

  private safeNumber(value: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > max ? max : value);
  }

  private compareBigInt(first: bigint, second: bigint): number {
    if (first === second) return 0;
    return first > second ? 1 : -1;
  }

  private chapterNumber(value: { toString(): string }): string {
    return value.toString().replace(/\.00$/, '');
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private weekdayLabel(date: Date): string {
    const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return labels[date.getDay()] ?? '';
  }

  private formatRelativeDate(date: Date, now: Date): string {
    const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private dateKey(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return userId;
  }
}
