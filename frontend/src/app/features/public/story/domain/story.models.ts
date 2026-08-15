import type { ChapterSummary, Story } from '../../../../shared/models/story.model';

export type { ChapterSummary, Story };

export interface StoryComment {
  readonly id: string;
  readonly userId: string;
  readonly user: string;
  readonly time: string;
  readonly content: string;
  readonly isOwner: boolean;
}

export interface RelatedStoryItem {
  readonly title: string;
  readonly slug: string;
  readonly coverUrl: string;
  readonly latestChapter: number | null;
}

export interface StoryDetailState {
  readonly story: Story | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly comments: readonly StoryComment[];
  readonly relatedStories: readonly RelatedStoryItem[];
}
