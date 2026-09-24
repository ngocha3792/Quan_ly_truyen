import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';

@Injectable()
export class PrismaRecommendationExperimentPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async assignVariant(userId: string): Promise<{
    variant: 'control' | 'treatment';
    experimentId: string | null;
  }> {
    const experiment = await this.prisma.recommendationExperiment.findFirst({
      where: {
        isActive: true,
        OR: [{ endedAt: null }, { endedAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !experiment ||
      (experiment.targetUserIds.length > 0 &&
        !experiment.targetUserIds.includes(userId))
    ) {
      return { variant: 'control', experimentId: null };
    }
    const bucket = this.hashUserId(userId) % 100;
    if (bucket < experiment.controlPercent)
      return { variant: 'control', experimentId: experiment.id };
    if (bucket < experiment.controlPercent + experiment.treatmentPercent)
      return { variant: 'treatment', experimentId: experiment.id };
    return { variant: 'control', experimentId: null };
  }

  async trackImpression(input: {
    userId?: string;
    context: string;
    storyId?: string;
    recommendedStoryIds: string[];
    algorithm: 'heuristic' | 'collaborative' | 'hybrid';
    experimentId?: string;
    variant?: 'control' | 'treatment';
  }): Promise<void> {
    if (input.recommendedStoryIds.length === 0) return;
    await this.prisma.recommendationImpression.create({
      data: {
        userId: input.userId,
        context: input.context,
        storyId: input.storyId,
        recommendedStoryIds: input.recommendedStoryIds,
        algorithm: input.algorithm,
        experimentId: input.experimentId,
        variant: input.variant,
      },
    });
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (const character of userId)
      hash = (hash * 31 + character.codePointAt(0)!) | 0;
    return Math.abs(hash);
  }
}
