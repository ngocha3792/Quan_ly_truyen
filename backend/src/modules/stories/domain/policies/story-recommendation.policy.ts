export interface RecommendationCategorySignal {
  readonly id: string;
  readonly name: string;
}

export interface RecommendationCandidateSignal {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly followerCount: number;
  readonly categories: readonly RecommendationCategorySignal[];
}

export interface RecommendationProfileSignal {
  readonly followedAuthorIds: ReadonlySet<string>;
  readonly categoryWeights: ReadonlyMap<string, number>;
}

export interface RankedRecommendation<T extends RecommendationCandidateSignal> {
  readonly candidate: T;
  readonly reasonCode:
    'FOLLOWED_AUTHOR' | 'PREFERRED_CATEGORY' | 'HIGH_RATING' | 'POPULAR';
  readonly reason: string;
  readonly matchedCategories: readonly string[];
}

export function rankStoryRecommendations<
  T extends RecommendationCandidateSignal,
>(
  candidates: readonly T[],
  profile: RecommendationProfileSignal,
  limit: number,
): readonly RankedRecommendation<T>[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, profile))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.candidate.ratingCount - left.candidate.ratingCount ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, Math.max(0, limit))
    .map(({ candidate, reasonCode, reason, matchedCategories }) => ({
      candidate,
      reasonCode,
      reason,
      matchedCategories,
    }));
}

function scoreCandidate<T extends RecommendationCandidateSignal>(
  candidate: T,
  profile: RecommendationProfileSignal,
) {
  const followedAuthor = profile.followedAuthorIds.has(candidate.authorId);
  const categoryMatches = candidate.categories
    .map((category) => ({
      ...category,
      weight: profile.categoryWeights.get(category.id) ?? 0,
    }))
    .filter((category) => category.weight > 0)
    .sort(
      (left, right) =>
        right.weight - left.weight || left.name.localeCompare(right.name),
    );
  const categoryScore = Math.min(
    8,
    categoryMatches.reduce((total, category) => total + category.weight, 0),
  );
  const confidence = candidate.ratingCount / (candidate.ratingCount + 20);
  const bayesianRating =
    confidence * candidate.ratingAverage + (1 - confidence) * 3.5;
  const score =
    (followedAuthor ? 40 : 0) +
    categoryScore * 6 +
    bayesianRating * 4 +
    Math.log10(candidate.ratingCount + 1) * 2 +
    Math.log10(candidate.followerCount + 1);

  if (followedAuthor) {
    return {
      candidate,
      score,
      reasonCode: 'FOLLOWED_AUTHOR' as const,
      reason: `Từ tác giả ${candidate.authorName} bạn đang theo dõi`,
      matchedCategories: categoryMatches.map((category) => category.name),
    };
  }
  if (categoryMatches[0]) {
    return {
      candidate,
      score,
      reasonCode: 'PREFERRED_CATEGORY' as const,
      reason: `Vì bạn thường đọc ${categoryMatches[0].name}`,
      matchedCategories: categoryMatches.map((category) => category.name),
    };
  }
  if (candidate.ratingCount > 0 && candidate.ratingAverage >= 4) {
    return {
      candidate,
      score,
      reasonCode: 'HIGH_RATING' as const,
      reason: `Được đánh giá ${candidate.ratingAverage.toFixed(1)}/5`,
      matchedCategories: [],
    };
  }
  return {
    candidate,
    score,
    reasonCode: 'POPULAR' as const,
    reason: 'Đang được độc giả quan tâm',
    matchedCategories: [],
  };
}
