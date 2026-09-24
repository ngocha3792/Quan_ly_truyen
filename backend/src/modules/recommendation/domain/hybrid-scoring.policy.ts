export interface HybridStoryScore {
  heuristicScore: number;
  collaborativeScore: number;
  freshnessScore: number;
  diversityScore: number;
}

export class HybridScoringPolicy {
  static readonly weights = {
    heuristic: 0.4,
    collaborative: 0.4,
    freshness: 0.1,
    diversity: 0.1,
  } as const;

  static combineScores(score: HybridStoryScore): number {
    return (
      score.heuristicScore * this.weights.heuristic +
      score.collaborativeScore * this.weights.collaborative +
      score.freshnessScore * this.weights.freshness +
      score.diversityScore * this.weights.diversity
    );
  }
}
