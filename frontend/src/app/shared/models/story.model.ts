export interface ChapterSummary {
  readonly number: number;
  readonly title?: string;
  readonly slug: string;
  readonly updatedAt: string;
}

export interface Story {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly description: string;
  readonly coverUrl: string;
  readonly categories: readonly string[];
  readonly latestChapter: ChapterSummary | null;
  readonly views: number;
  readonly rating: number;
  readonly chapterCount?: number;
  readonly status: 'ONGOING' | 'COMPLETED' | 'HIATUS';
  readonly badge?: 'NEW' | 'HOT' | 'FULL';
}

export interface HeroSlide {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly storySlug: string;
  readonly latestChapter: number;
  readonly accent: 'violet' | 'blue' | 'orange';
}

export interface QuickAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string;
}

export interface HomePageData {
  readonly heroSlides: readonly HeroSlide[];
  readonly quickActions: readonly QuickAction[];
  readonly latestStories: readonly Story[];
  readonly recommendedStories: readonly Story[];
  readonly topStories: readonly Story[];
  readonly recentUpdates: readonly Story[];
}

export const STORY_COVER_PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><rect width="320" height="480" fill="#e5e7eb"/><path d="M90 120h140v240H90z" fill="#cbd5e1"/><path d="M115 165h90M115 205h90M115 245h70" stroke="#94a3b8" stroke-width="12" stroke-linecap="round"/></svg>');
