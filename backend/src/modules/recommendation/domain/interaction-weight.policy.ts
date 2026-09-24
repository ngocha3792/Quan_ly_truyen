export type RecommendationInteractionType =
  | 'CHAPTER_COMPLETED'
  | 'CHAPTER_DWELL'
  | 'STORY_FOLLOWED'
  | 'STORY_FAVORITED'
  | 'STORY_RATED';

export class InteractionWeightPolicy {
  static readonly weights = {
    chapterCompleted: 1,
    storyFollowed: 0.8,
    storyFavorited: 0.9,
    storyRated: 0.7,
  } as const;

  static calculateDwellWeight(dwellSeconds: number): number {
    if (!Number.isFinite(dwellSeconds) || dwellSeconds < 30) return 0;
    return Math.min(dwellSeconds / 300, 1) * 0.8;
  }

  static isPositiveRating(rating: number): boolean {
    return Number.isInteger(rating) && rating >= 4 && rating <= 5;
  }
}
