import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import {
  HybridScoringPolicy,
  InteractionWeightPolicy,
  type RecommendationInteractionType,
} from '../../domain';

export interface RecordInteractionInput {
  readonly userId: string;
  readonly storyId: string;
  readonly interactionType: RecommendationInteractionType;
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

@Injectable()
export class PrismaRecommendationPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { recommendationOptOut: true },
    });
    return { personalizationEnabled: user ? !user.recommendationOptOut : true };
  }

  async updatePreferences(userId: string, enabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { recommendationOptOut: !enabled },
    });
    return { personalizationEnabled: enabled };
  }

  async recordInteraction(input: RecordInteractionInput): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { recommendationOptOut: true },
    });
    if (!user || user.recommendationOptOut) return false;

    if (
      input.interactionType === 'CHAPTER_DWELL' &&
      (!input.dwellSeconds || input.dwellSeconds < 30)
    )
      return false;
    if (
      input.interactionType === 'STORY_RATED' &&
      (!input.rating || !InteractionWeightPolicy.isPositiveRating(input.rating))
    )
      return false;

    const weight = this.resolveWeight(input);
    if (weight <= 0) return false;

    const existing = await this.prisma.userStoryInteraction.findFirst({
      where: {
        userId: input.userId,
        storyId: input.storyId,
        interactionType: input.interactionType,
        chapterId: input.chapterId ?? null,
      },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.userStoryInteraction.update({
        where: { id: existing.id },
        data: {
          weight,
          dwellSeconds: input.dwellSeconds,
          rating: input.rating,
        },
      });
    } else
      await this.prisma.userStoryInteraction.create({
        data: {
          userId: input.userId,
          storyId: input.storyId,
          interactionType: input.interactionType,
          chapterId: input.chapterId ?? null,
          dwellSeconds: input.dwellSeconds,
          rating: input.rating,
          weight,
        },
      });
    return true;
  }

  async calculateItemSimilarity(
    startDate: Date,
    endDate: Date,
    modelVersion: string,
  ): Promise<SimilarityRunResult> {
    if (endDate.getTime() - startDate.getTime() < 42 * 24 * 60 * 60 * 1000) {
      return {
        skipped: true,
        reason: 'INSUFFICIENT_HISTORY',
        scores: 0,
        interactionCount: 0,
        modelVersion,
      };
    }
    const interactions = await this.prisma.userStoryInteraction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { userId: true, storyId: true, weight: true },
    });
    if (interactions.length < 1000) {
      return {
        skipped: true,
        reason: 'INSUFFICIENT_DATA',
        scores: 0,
        interactionCount: interactions.length,
        modelVersion,
      };
    }

    const userStories = new Map<string, Set<string>>();
    for (const interaction of interactions) {
      const stories = userStories.get(interaction.userId) ?? new Set<string>();
      stories.add(interaction.storyId);
      userStories.set(interaction.userId, stories);
    }
    const occurrences = new Map<string, number>();
    const pairs = new Map<string, number>();
    for (const stories of userStories.values()) {
      const list = [...stories];
      for (const story of list)
        occurrences.set(story, (occurrences.get(story) ?? 0) + 1);
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const left = list[i];
          const right = list[j];
          pairs.set(
            `${left}:${right}`,
            (pairs.get(`${left}:${right}`) ?? 0) + 1,
          );
          pairs.set(
            `${right}:${left}`,
            (pairs.get(`${right}:${left}`) ?? 0) + 1,
          );
        }
    }
    const now = new Date();
    const scores = [...pairs.entries()].flatMap(([key, count]) => {
      const [sourceStoryId, targetStoryId] = key.split(':');
      const union =
        (occurrences.get(sourceStoryId) ?? 0) +
        (occurrences.get(targetStoryId) ?? 0) -
        count;
      const score = union > 0 ? count / union : 0;
      return score >= 0.05 && count >= 3
        ? [
            {
              sourceStoryId,
              targetStoryId,
              collaborativeScore: score,
              coOccurrenceCount: count,
            },
          ]
        : [];
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.storyRecommendationScore.deleteMany({ where: { modelVersion } });
      for (let i = 0; i < scores.length; i += 1000) {
        await tx.storyRecommendationScore.createMany({
          data: scores
            .slice(i, i + 1000)
            .map((score) => ({ ...score, modelVersion, calculatedAt: now })),
        });
      }
      await tx.recommendationModel.upsert({
        where: { version: modelVersion },
        create: {
          version: modelVersion,
          algorithm: 'item_item',
          startDate,
          endDate,
          interactionCount: interactions.length,
          uniqueUsers: userStories.size,
          uniqueStories: occurrences.size,
          parameters: { minCoOccurrence: 3, minSimilarity: 0.05 },
          trainedAt: now,
        },
        update: {
          startDate,
          endDate,
          interactionCount: interactions.length,
          uniqueUsers: userStories.size,
          uniqueStories: occurrences.size,
          parameters: { minCoOccurrence: 3, minSimilarity: 0.05 },
          trainedAt: now,
        },
      });
    });
    return {
      skipped: false,
      scores: scores.length,
      interactionCount: interactions.length,
      modelVersion,
    };
  }

  async getCollaborativeRecommendations(userId: string, limit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { recommendationOptOut: true },
    });
    if (!user || user.recommendationOptOut) return [];
    const interactions = await this.prisma.userStoryInteraction.findMany({
      where: { userId },
      select: { storyId: true, weight: true },
    });
    if (!interactions.length) return [];
    const recommendations = new Map<string, number>();
    for (const interaction of interactions) {
      const similar = await this.prisma.storyRecommendationScore.findMany({
        where: { sourceStoryId: interaction.storyId },
        orderBy: { collaborativeScore: 'desc' },
        take: 20,
      });
      for (const score of similar)
        recommendations.set(
          score.targetStoryId,
          (recommendations.get(score.targetStoryId) ?? 0) +
            Number(interaction.weight) * Number(score.collaborativeScore),
        );
    }
    const seen = new Set(interactions.map((entry) => entry.storyId));
    return [...recommendations.entries()]
      .filter(([storyId]) => !seen.has(storyId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([storyId, score]) => ({ storyId, score }));
  }

  combineScore(
    score: Parameters<typeof HybridScoringPolicy.combineScores>[0],
  ): number {
    return HybridScoringPolicy.combineScores(score);
  }

  private resolveWeight(input: RecordInteractionInput): number {
    if (input.weight !== undefined)
      return Math.min(1, Math.max(0, input.weight));
    switch (input.interactionType) {
      case 'CHAPTER_COMPLETED':
        return InteractionWeightPolicy.weights.chapterCompleted;
      case 'STORY_FOLLOWED':
        return InteractionWeightPolicy.weights.storyFollowed;
      case 'STORY_FAVORITED':
        return InteractionWeightPolicy.weights.storyFavorited;
      case 'STORY_RATED':
        return InteractionWeightPolicy.weights.storyRated;
      case 'CHAPTER_DWELL':
        return InteractionWeightPolicy.calculateDwellWeight(
          input.dwellSeconds ?? 0,
        );
    }
    return 0;
  }
}
