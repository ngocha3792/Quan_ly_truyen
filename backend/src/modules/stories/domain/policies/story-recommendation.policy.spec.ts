import { rankStoryRecommendations } from './story-recommendation.policy';

describe('story recommendation policy', () => {
  const candidates = [
    candidate('followed', 'author-followed', 3.8, 20, ['romance']),
    candidate('category', 'author-2', 4.4, 60, ['fantasy']),
    candidate('quality', 'author-3', 4.9, 200, ['mystery']),
  ];

  it('prioritizes explicit follows and explains the recommendation', () => {
    const [first] = rankStoryRecommendations(
      candidates,
      {
        followedAuthorIds: new Set(['author-followed']),
        categoryWeights: new Map([['fantasy', 2]]),
      },
      3,
    );

    expect(first).toMatchObject({
      candidate: { id: 'followed' },
      reasonCode: 'FOLLOWED_AUTHOR',
      reason: 'Từ tác giả Tác giả followed bạn đang theo dõi',
    });
  });

  it('uses category affinity before global rating when no author matches', () => {
    const [first] = rankStoryRecommendations(
      candidates,
      {
        followedAuthorIds: new Set(),
        categoryWeights: new Map([['fantasy', 4]]),
      },
      3,
    );

    expect(first).toMatchObject({
      candidate: { id: 'category' },
      reasonCode: 'PREFERRED_CATEGORY',
      matchedCategories: ['Thể loại fantasy'],
    });
  });

  it('falls back to confidence-adjusted rating for an empty profile', () => {
    const [first] = rankStoryRecommendations(
      candidates,
      { followedAuthorIds: new Set(), categoryWeights: new Map() },
      1,
    );

    expect(first).toMatchObject({
      candidate: { id: 'quality' },
      reasonCode: 'HIGH_RATING',
    });
  });
});

function candidate(
  id: string,
  authorId: string,
  ratingAverage: number,
  ratingCount: number,
  categories: readonly string[],
) {
  return {
    id,
    authorId,
    authorName: `Tác giả ${id}`,
    ratingAverage,
    ratingCount,
    followerCount: ratingCount,
    categories: categories.map((category) => ({
      id: category,
      name: `Thể loại ${category}`,
    })),
  };
}
