import { IconName } from '../../../../shared/components/icon/icon.component';

export type AuthorStudioPeriod = '7d' | '30d' | '90d';

export type StudioMetricTone = 'purple' | 'blue' | 'orange' | 'indigo' | 'pink' | 'green';

export interface AuthorStudioProfile {
  readonly displayName: string;
  readonly penName: string;
  readonly avatarUrl: string;
  readonly verified: boolean;
}

export interface AuthorStudioMetric {
  readonly id: string;
  readonly title: string;
  readonly value: string;
  readonly icon: IconName;
  readonly tone: StudioMetricTone;
}

export interface ReadershipChartPoint {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

export interface PublicationScheduleItem {
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

export interface AuthorStudioStory {
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

export interface AuthorStudioDraft {
  readonly id: string;
  readonly storyTitle: string;
  readonly chapterTitle: string;
  readonly updatedAt: string;
  readonly completionPercent: number;
}

export interface AuthorReaderComment {
  readonly id: string;
  readonly readerName: string;
  readonly avatarUrl: string;
  readonly storyTitle: string;
  readonly content: string;
  readonly createdAt: string;
}

export interface AuthorTopStory {
  readonly id: string;
  readonly rank: number;
  readonly title: string;
  readonly coverUrl: string;
  readonly views: string;
}

export interface AuthorMonthlyGoal {
  readonly id: string;
  readonly label: string;
  readonly currentValue: string;
  readonly targetValue: string;
  readonly progress: number;
  readonly icon: IconName;
  readonly tone: StudioMetricTone;
}

export interface AuthorStudioDashboard {
  readonly profile: AuthorStudioProfile;
  readonly unreadNotifications: number;
  readonly metrics: readonly AuthorStudioMetric[];

  readonly readership: Readonly<Record<AuthorStudioPeriod, readonly ReadershipChartPoint[]>>;

  readonly schedule: readonly PublicationScheduleItem[];

  readonly stories: readonly AuthorStudioStory[];

  readonly drafts: readonly AuthorStudioDraft[];

  readonly comments: readonly AuthorReaderComment[];

  readonly topStories: readonly AuthorTopStory[];

  readonly monthlyGoals: readonly AuthorMonthlyGoal[];
}
