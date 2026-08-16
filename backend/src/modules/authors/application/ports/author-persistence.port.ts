export const AUTHOR_PERSISTENCE_PORT = Symbol('AUTHOR_PERSISTENCE_PORT');

/* ------------------------------------------------------------------ */
/* Raw records returned from infrastructure                             */
/* ------------------------------------------------------------------ */

export interface AuthorProfileListRecord {
  readonly userId: string;
  readonly penName: string;
  readonly slug: string;
  readonly biography: string | null;
  readonly verificationStatus: string;
  readonly featuredRank: number | null;
  readonly followerCount: number;
  readonly totalReadCount: bigint;
  readonly storyCount: number;
  readonly user: {
    readonly avatarMedia: {
      readonly secureUrl: string | null;
      readonly publicUrl: string | null;
      readonly status: string;
      readonly deletedAt: Date | null;
    } | null;
  };
  readonly stories: readonly {
    readonly categories: readonly {
      readonly category: { readonly name: string };
    }[];
  }[];
}

export interface AuthorProfileNewRecord {
  readonly userId: string;
  readonly penName: string;
  readonly slug: string;
  readonly verificationStatus: string;
  readonly storyCount: number;
  readonly totalReadCount: bigint;
}

export interface AuthorProfileAggregateRecord {
  readonly totalAuthors: number;
  readonly totalStories: number | null;
  readonly totalReads: bigint | null;
  readonly totalFollowers: number | null;
}

export interface AuthorProfileDetailRecord {
  readonly userId: string;
  readonly penName: string;
  readonly slug: string;
  readonly biography: string | null;
  readonly socialLinks: unknown;
  readonly websiteUrl: string | null;
  readonly bannerMedia: {
    readonly secureUrl: string | null;
    readonly publicUrl: string | null;
    readonly status: string;
    readonly deletedAt: Date | null;
  } | null;
  readonly verificationStatus: string;
  readonly verifiedAt: Date | null;
  readonly followerCount: number;
  readonly totalReadCount: bigint;
  readonly storyCount: number;
  readonly createdAt: Date;
  readonly user: {
    readonly displayName: string;
    readonly avatarMedia: {
      readonly secureUrl: string | null;
      readonly publicUrl: string | null;
      readonly status: string;
      readonly deletedAt: Date | null;
    } | null;
  };
  readonly stories: readonly {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly synopsis: string;
    readonly viewCount: bigint;
    readonly chapterCount: number;
    readonly ratingAverage: { toString(): string };
    readonly ratingCount: number;
    readonly publishedAt: Date | null;
    readonly categories: readonly {
      readonly category: { readonly name: string };
    }[];
  }[];
}

export interface RecentChapterRecord {
  readonly id: string;
  readonly number: { toString(): string };
  readonly title: string;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly story: { readonly title: string };
}

export interface AuthorDashboardProfileRecord {
  readonly penName: string;
  readonly verificationStatus: string;
  readonly followerCount: number;
  readonly user: {
    readonly displayName: string;
    readonly avatarMedia: {
      readonly secureUrl: string | null;
      readonly publicUrl: string | null;
    } | null;
  };
}

export interface DashboardStoryRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly viewCount: bigint;
  readonly chapterCount: number;
  readonly updatedAt: Date;
  readonly coverMedia: {
    readonly secureUrl: string | null;
    readonly publicUrl: string | null;
  } | null;
  readonly categories: readonly {
    readonly category: { readonly name: string };
  }[];
}

export interface DraftChapterRecord {
  readonly id: string;
  readonly title: string;
  readonly wordCount: number;
  readonly updatedAt: Date;
  readonly story: { readonly title: string };
}

export interface ScheduledChapterRecord {
  readonly id: string;
  readonly number: { toString(): string };
  readonly title: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly story: {
    readonly title: string;
    readonly coverMedia: {
      readonly secureUrl: string | null;
      readonly publicUrl: string | null;
    } | null;
  };
}

export interface DashboardCommentRecord {
  readonly id: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly user: {
    readonly displayName: string;
    readonly avatarMedia: {
      readonly secureUrl: string | null;
      readonly publicUrl: string | null;
    } | null;
  };
  readonly story: { readonly title: string };
}

export interface DailyStatRecord {
  readonly date: Date;
  readonly viewCount: bigint;
}

/* ------------------------------------------------------------------ */
/* Port interface                                                        */
/* ------------------------------------------------------------------ */

export interface AuthorPersistencePort {
  findDirectoryAuthors(): Promise<readonly AuthorProfileListRecord[]>;

  findNewAuthors(limit: number): Promise<readonly AuthorProfileNewRecord[]>;

  aggregateDirectoryStats(): Promise<AuthorProfileAggregateRecord>;

  findAuthorBySlug(slug: string): Promise<AuthorProfileDetailRecord | null>;

  findRecentChaptersByAuthor(
    authorId: string,
    limit: number,
  ): Promise<readonly RecentChapterRecord[]>;

  findDashboardProfile(
    userId: string,
  ): Promise<AuthorDashboardProfileRecord | null>;

  findDashboardStories(
    userId: string,
  ): Promise<readonly DashboardStoryRecord[]>;

  findDraftChapters(
    userId: string,
    limit: number,
  ): Promise<readonly DraftChapterRecord[]>;

  findScheduledChapters(
    userId: string,
    limit: number,
  ): Promise<readonly ScheduledChapterRecord[]>;

  findRecentComments(
    userId: string,
    limit: number,
  ): Promise<readonly DashboardCommentRecord[]>;

  findDailyStats(
    userId: string,
    from: Date,
  ): Promise<readonly DailyStatRecord[]>;

  countUnreadNotifications(userId: string, now: Date): Promise<number>;

  countPublishedChaptersThisMonth(userId: string, from: Date): Promise<number>;
}
