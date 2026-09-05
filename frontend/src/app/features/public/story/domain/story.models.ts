import type { ChapterSummary, Story } from '../../../../shared/models/story.model';
import type { PublicComment } from '../../comments';

export type { ChapterSummary, Story };

export type StoryComment = PublicComment;

export interface RelatedStoryItem {
  readonly title: string;
  readonly slug: string;
  readonly coverUrl: string;
  readonly latestChapter: number | null;
}

export interface StoryChapterListItem {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly publishedAt: string;
}

export interface StoryChapterListPage {
  readonly items: readonly StoryChapterListItem[];
  readonly page: number;
  readonly totalPages: number;
}

export interface StoryDetailState {
  readonly story: Story | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly comments: readonly StoryComment[];
  readonly relatedStories: readonly RelatedStoryItem[];
}
