import type {
  AuthorDashboardDto,
  AuthorReaderCommentDto,
  AuthorStudioDraftDto,
  AuthorStudioStoryDto,
  AuthorTopStoryDto,
  PublicationScheduleItemDto,
  ReadershipChartPointDto,
} from '../dto';
import type {
  AuthorDashboardProfileRecord,
  DailyStatRecord,
  DashboardCommentRecord,
  DashboardStoryRecord,
  DraftChapterRecord,
  ScheduledChapterRecord,
} from '../ports';

const PUBLIC_STORY_STATUSES = ['PUBLISHED', 'HIATUS', 'COMPLETED'] as const;
const EMPTY_COVER_URL = '/assets/images/story-cover-placeholder.svg';
const EMPTY_AVATAR_URL = '/assets/images/avatar-placeholder.svg';

export interface AuthorDashboardMapperInput {
  readonly profile: AuthorDashboardProfileRecord;
  readonly stories: readonly DashboardStoryRecord[];
  readonly draftChapters: readonly DraftChapterRecord[];
  readonly scheduledChapters: readonly ScheduledChapterRecord[];
  readonly comments: readonly DashboardCommentRecord[];
  readonly dailyStats: readonly DailyStatRecord[];
  readonly unreadNotifications: number;
  readonly publishedThisMonth: number;
}

export class AuthorDashboardMapper {
  static toDto(
    input: AuthorDashboardMapperInput,
    now: Date,
  ): AuthorDashboardDto {
    const {
      profile,
      stories,
      draftChapters,
      scheduledChapters,
      comments,
      dailyStats,
      unreadNotifications,
      publishedThisMonth,
    } = input;

    const start30Days = AuthorDashboardMapper.startOfDay(
      AuthorDashboardMapper.addDays(now, -29),
    );

    const publishedStories = stories.filter((story) =>
      PUBLIC_STORY_STATUSES.includes(
        story.status as (typeof PUBLIC_STORY_STATUSES)[number],
      ),
    );
    const currentDrafts = stories.filter(
      (story) => story.status === 'DRAFT',
    ).length;
    const totalChapters = stories.reduce(
      (sum, story) => sum + story.chapterCount,
      0,
    );
    const pendingChapters = scheduledChapters.filter(
      (chapter) => chapter.status === 'SCHEDULED',
    ).length;
    const views30Days = dailyStats
      .filter((stat) => stat.date >= start30Days)
      .reduce(
        (sum, stat) => sum + AuthorDashboardMapper.safeNumber(stat.viewCount),
        0,
      );

    const directTrend = {
      trendValue: 'Trực tiếp',
      trendLabel: 'từ hệ thống',
      trendDirection: 'up' as const,
    };

    return {
      profile: {
        displayName: profile.user.displayName,
        penName: profile.penName,
        avatarUrl:
          AuthorDashboardMapper.mediaUrl(profile.user.avatarMedia) ??
          EMPTY_AVATAR_URL,
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
          value: AuthorDashboardMapper.formatCompact(publishedStories.length),
          ...directTrend,
          icon: 'book',
          tone: 'purple',
        },
        {
          id: 'drafts',
          title: 'Bản nháp',
          value: AuthorDashboardMapper.formatCompact(
            currentDrafts + draftChapters.length,
          ),
          ...directTrend,
          icon: 'draft',
          tone: 'blue',
        },
        {
          id: 'pending-chapters',
          title: 'Chương đã lên lịch',
          value: AuthorDashboardMapper.formatCompact(pendingChapters),
          ...directTrend,
          icon: 'clock',
          tone: 'orange',
        },
        {
          id: 'views',
          title: 'Lượt xem 30 ngày',
          value: AuthorDashboardMapper.formatCompact(views30Days),
          ...directTrend,
          icon: 'eye',
          tone: 'indigo',
        },
        {
          id: 'followers',
          title: 'Người theo dõi',
          value: AuthorDashboardMapper.formatCompact(profile.followerCount),
          ...directTrend,
          icon: 'users',
          tone: 'pink',
        },
      ],
      readership: {
        '7d': AuthorDashboardMapper.buildReadershipPoints(dailyStats, now, 7),
        '30d': AuthorDashboardMapper.buildReadershipPoints(dailyStats, now, 30),
        '90d': AuthorDashboardMapper.buildReadershipPoints(dailyStats, now, 90),
      },
      schedule: scheduledChapters.map((chapter): PublicationScheduleItemDto => {
        const scheduledAt = chapter.scheduledAt!;
        const status = AuthorDashboardMapper.scheduleStatus(chapter.status);

        return {
          id: chapter.id,
          weekday: AuthorDashboardMapper.weekdayLabel(scheduledAt),
          date: AuthorDashboardMapper.formatShortDate(scheduledAt),
          storyTitle: chapter.story.title,
          chapterTitle: `Chương ${AuthorDashboardMapper.chapterNumber(chapter.number)}: ${chapter.title}`,
          time: AuthorDashboardMapper.formatTime(scheduledAt),
          status: status.value,
          statusLabel: status.label,
          coverUrl:
            AuthorDashboardMapper.mediaUrl(chapter.story.coverMedia) ??
            EMPTY_COVER_URL,
        };
      }),
      stories: stories.slice(0, 8).map((story): AuthorStudioStoryDto => {
        const status = AuthorDashboardMapper.studioStoryStatus(story.status);

        return {
          id: story.id,
          slug: story.slug,
          title: story.title,
          coverUrl:
            AuthorDashboardMapper.mediaUrl(story.coverMedia) ?? EMPTY_COVER_URL,
          genres: story.categories.map((category) => category.category.name),
          status: status.value,
          statusLabel: status.label,
          latestChapter: story.chapterCount,
          updatedAt: AuthorDashboardMapper.formatDate(story.updatedAt),
        };
      }),
      drafts: draftChapters.map((chapter): AuthorStudioDraftDto => ({
        id: chapter.id,
        storyTitle: chapter.story.title,
        chapterTitle: chapter.title,
        updatedAt: AuthorDashboardMapper.formatDateTime(chapter.updatedAt),
        completionPercent: AuthorDashboardMapper.draftCompletion(
          chapter.wordCount,
        ),
      })),
      comments: comments.map((comment): AuthorReaderCommentDto => ({
        id: comment.id,
        readerName: comment.user.displayName,
        avatarUrl:
          AuthorDashboardMapper.mediaUrl(comment.user.avatarMedia) ??
          EMPTY_AVATAR_URL,
        storyTitle: comment.story.title,
        content: comment.body,
        createdAt: AuthorDashboardMapper.formatRelativeDate(
          comment.createdAt,
          now,
        ),
        unread: false,
      })),
      topStories: [...stories]
        .sort((first, second) =>
          AuthorDashboardMapper.compareBigInt(
            first.viewCount,
            second.viewCount,
          ),
        )
        .slice(0, 3)
        .map((story, index): AuthorTopStoryDto => ({
          id: story.id,
          rank: index + 1,
          title: story.title,
          coverUrl:
            AuthorDashboardMapper.mediaUrl(story.coverMedia) ?? EMPTY_COVER_URL,
          views: AuthorDashboardMapper.formatCompact(story.viewCount),
        })),
      monthlyGoals: [
        {
          id: 'goal-chapters',
          label: 'Chương xuất bản',
          currentValue: String(publishedThisMonth),
          targetValue: String(
            AuthorDashboardMapper.nextGoalTarget(publishedThisMonth, 10),
          ),
          progress: AuthorDashboardMapper.progress(
            publishedThisMonth,
            AuthorDashboardMapper.nextGoalTarget(publishedThisMonth, 10),
          ),
          icon: 'book',
          tone: 'purple',
        },
        {
          id: 'goal-views',
          label: 'Lượt xem',
          currentValue: AuthorDashboardMapper.formatCompact(views30Days),
          targetValue: AuthorDashboardMapper.formatCompact(
            AuthorDashboardMapper.nextGoalTarget(views30Days, 10_000),
          ),
          progress: AuthorDashboardMapper.progress(
            views30Days,
            AuthorDashboardMapper.nextGoalTarget(views30Days, 10_000),
          ),
          icon: 'eye',
          tone: 'indigo',
        },
      ] as const,
    };
  }

  private static buildReadershipPoints(
    stats: readonly DailyStatRecord[],
    now: Date,
    days: number,
  ): readonly ReadershipChartPointDto[] {
    const byDate = new Map<string, number>();

    for (const stat of stats) {
      const key = AuthorDashboardMapper.dateKey(stat.date);
      byDate.set(
        key,
        (byDate.get(key) ?? 0) +
          AuthorDashboardMapper.safeNumber(stat.viewCount),
      );
    }

    return Array.from({ length: days }, (_, index) => {
      const date = AuthorDashboardMapper.startOfDay(
        AuthorDashboardMapper.addDays(now, index - days + 1),
      );
      const key = AuthorDashboardMapper.dateKey(date);

      return {
        id: `${days}d-${key}`,
        label: AuthorDashboardMapper.formatShortDate(date),
        value: byDate.get(key) ?? 0,
      };
    });
  }

  private static scheduleStatus(status: string): {
    readonly value: PublicationScheduleItemDto['status'];
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

  private static studioStoryStatus(status: string): {
    readonly value: AuthorStudioStoryDto['status'];
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

  private static draftCompletion(wordCount: number): number {
    return Math.min(100, Math.max(5, Math.round((wordCount / 2_000) * 100)));
  }

  private static nextGoalTarget(current: number, step: number): number {
    return Math.max(step, (Math.floor(current / step) + 1) * step);
  }

  private static progress(current: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  }

  private static mediaUrl(
    media: {
      readonly secureUrl: string | null;
      readonly publicUrl: string | null;
    } | null,
  ): string | null {
    return media?.secureUrl ?? media?.publicUrl ?? null;
  }

  private static formatCompact(value: bigint | number): string {
    const numericValue = typeof value === 'bigint' ? Number(value) : value;

    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numericValue);
  }

  private static safeNumber(value: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > max ? max : value);
  }

  private static compareBigInt(first: bigint, second: bigint): number {
    if (first === second) return 0;
    return first < second ? 1 : -1;
  }

  private static chapterNumber(value: { toString(): string }): string {
    return value.toString().replace(/\.00$/, '');
  }

  private static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private static formatDateTime(date: Date): string {
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

  private static formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private static formatTime(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private static weekdayLabel(date: Date): string {
    const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return labels[date.getDay()] ?? '';
  }

  private static formatRelativeDate(date: Date, now: Date): string {
    const minutes = Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / 60_000),
    );

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  private static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private static dateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
