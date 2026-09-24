export interface RecordInteractionInput {
  readonly userId: string;
  readonly storyId: string;
  readonly interactionType: import('../../domain').RecommendationInteractionType;
  readonly chapterId?: string;
  readonly dwellSeconds?: number;
  readonly rating?: number;
  readonly weight?: number;
}
export interface SimilarityRunResult {
  readonly skipped: boolean;
  readonly reason?: 'INSUFFICIENT_DATA' | 'INSUFFICIENT_HISTORY';
  readonly scores: number;
  readonly interactionCount: number;
  readonly modelVersion: string;
}

export const RECOMMENDATION_PORT = Symbol('RECOMMENDATION_PORT');
export const RECOMMENDATION_EXPERIMENT_PORT = Symbol(
  'RECOMMENDATION_EXPERIMENT_PORT',
);

export interface RecommendationPort {
  recordInteraction(input: RecordInteractionInput): Promise<boolean>;
  getCollaborativeRecommendations(
    userId: string,
    limit?: number,
  ): Promise<Array<{ storyId: string; score: number }>>;
  calculateItemSimilarity(
    startDate: Date,
    endDate: Date,
    modelVersion: string,
  ): Promise<SimilarityRunResult>;
  getPreferences(userId: string): Promise<{ personalizationEnabled: boolean }>;
  updatePreferences(
    userId: string,
    enabled: boolean,
  ): Promise<{ personalizationEnabled: boolean }>;
}

export interface RecommendationExperimentPort {
  trackImpression(input: {
    userId?: string;
    context: string;
    storyId?: string;
    recommendedStoryIds: string[];
    algorithm: 'heuristic' | 'collaborative' | 'hybrid';
    experimentId?: string;
    variant?: 'control' | 'treatment';
  }): Promise<void>;
}
