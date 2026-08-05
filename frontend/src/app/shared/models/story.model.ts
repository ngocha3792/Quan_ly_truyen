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
  readonly latestChapter: ChapterSummary;
  readonly views: number;
  readonly rating: number;
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
