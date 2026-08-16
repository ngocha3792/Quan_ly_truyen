export type AuthorWorkTone = 'blue' | 'gold' | 'violet' | 'crimson' | 'cyan';

export interface AuthorDirectoryItemDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly initials: string;
  readonly genre: string;
  readonly description: string;
  readonly verified: boolean;
  readonly avatarUrl?: string | null;
  readonly worksLabel: string;
  readonly readsLabel: string;
  readonly followersLabel: string;
  readonly works: number;
  readonly reads: number;
  readonly followers: number;
  readonly featuredRank: number;
}

export interface NewAuthorItemDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly initials: string;
  readonly worksLabel: string;
  readonly readsLabel: string;
  readonly verified: boolean;
}

export interface AuthorDirectoryDto {
  readonly authors: readonly AuthorDirectoryItemDto[];
  readonly statistics: {
    readonly authors: string;
    readonly works: string;
    readonly reads: string;
    readonly followers: string;
  };
  readonly newAuthors: readonly NewAuthorItemDto[];
}

export interface AuthorWorkDto {
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

export interface AuthorDetailDto {
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
    readonly avatarUrl: string | null;
    readonly bannerUrl: string | null;
    readonly socialLinks: {
      readonly website: string | null;
      readonly facebook: string | null;
      readonly instagram: string | null;
      readonly x: string | null;
      readonly youtube: string | null;
      readonly tiktok: string | null;
    };
    readonly biography: readonly string[];
  };
  readonly statistics: {
    readonly totalWorks: number;
    readonly followers: string;
    readonly followersCount: number;
    readonly totalReads: string;
    readonly averageRating: string;
  };
  readonly featuredWorks: readonly AuthorWorkDto[];
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

export interface ReadershipChartPointDto {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

export interface PublicationScheduleItemDto {
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

export interface AuthorStudioStoryDto {
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

export interface AuthorStudioDraftDto {
  readonly id: string;
  readonly storyTitle: string;
  readonly chapterTitle: string;
  readonly updatedAt: string;
  readonly completionPercent: number;
}

export interface AuthorReaderCommentDto {
  readonly id: string;
  readonly readerName: string;
  readonly avatarUrl: string;
  readonly storyTitle: string;
  readonly content: string;
  readonly createdAt: string;
  readonly unread: boolean;
}

export interface AuthorTopStoryDto {
  readonly id: string;
  readonly rank: number;
  readonly title: string;
  readonly coverUrl: string;
  readonly views: string;
}

export interface AuthorMonthlyGoalDto {
  readonly id: string;
  readonly label: string;
  readonly currentValue: string;
  readonly targetValue: string;
  readonly progress: number;
  readonly icon: 'book' | 'eye';
  readonly tone: 'purple' | 'indigo';
}

export interface AuthorDashboardDto {
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
    Record<'7d' | '30d' | '90d', readonly ReadershipChartPointDto[]>
  >;
  readonly schedule: readonly PublicationScheduleItemDto[];
  readonly stories: readonly AuthorStudioStoryDto[];
  readonly drafts: readonly AuthorStudioDraftDto[];
  readonly comments: readonly AuthorReaderCommentDto[];
  readonly topStories: readonly AuthorTopStoryDto[];
  readonly monthlyGoals: readonly AuthorMonthlyGoalDto[];
}
