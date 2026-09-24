import { HybridScoringPolicy, InteractionWeightPolicy } from './index';

describe('recommendation policies', () => {
  it('weights only meaningful implicit signals', () => {
    expect(InteractionWeightPolicy.calculateDwellWeight(29)).toBe(0);
    expect(InteractionWeightPolicy.calculateDwellWeight(300)).toBe(0.8);
    expect(InteractionWeightPolicy.isPositiveRating(3)).toBe(false);
    expect(InteractionWeightPolicy.isPositiveRating(5)).toBe(true);
  });

  it('combines hybrid components with bounded configured weights', () => {
    expect(
      HybridScoringPolicy.combineScores({
        heuristicScore: 1,
        collaborativeScore: 0.5,
        freshnessScore: 0.8,
        diversityScore: 0.2,
      }),
    ).toBeCloseTo(0.7);
  });
});
