export type AuthorWorkTone = 'blue' | 'gold' | 'violet' | 'crimson' | 'cyan';

export interface AuthorProfile {
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
}

export interface AuthorStatistics {
  readonly totalWorks: number;
  readonly followers: string;
  readonly totalReads: string;
  readonly averageRating: string;
}

export interface AuthorWork {
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

export interface AuthorTimelineItem {
  readonly year: string;
  readonly title: string;
  readonly description: string;
}

export interface AuthorRecentUpdate {
  readonly id: string;
  readonly workTitle: string;
  readonly chapterTitle: string;
  readonly updatedAt: string;
}

export interface AuthorHotWork {
  readonly rank: number;
  readonly title: string;
  readonly genre: string;
  readonly reads: string;
  readonly tone: AuthorWorkTone;
}

export interface AuthorDetailView {
  readonly profile: AuthorProfile;
  readonly statistics: AuthorStatistics;
  readonly featuredWorks: readonly AuthorWork[];
  readonly timeline: readonly AuthorTimelineItem[];
  readonly recentUpdates: readonly AuthorRecentUpdate[];
  readonly hotWorks: readonly AuthorHotWork[];
}
