import { Injectable } from '@nestjs/common';

import {
  AiFallbackPolicy as PrismaAiFallbackPolicy,
  AiRateLimitTier as PrismaAiRateLimitTier,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import {
  AiPolicyPersistencePort,
  AiUserPolicyRecord,
  UpdateAiUserPolicyInput,
} from '../../application/ports/ai-policy.persistence.port';
import { AiFallbackPolicy, AiRateLimitTier } from '../../domain/enums';

const DEFAULT_POLICY: Omit<AiUserPolicyRecord, 'userId'> = {
  rateLimitTier: AiRateLimitTier.FREE,
  fallbackPolicy: AiFallbackPolicy.NONE,
  createdAt: null,
  updatedAt: null,
};

@Injectable()
export class PrismaAiPolicyPersistence implements AiPolicyPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<AiUserPolicyRecord | null> {
    const record = await this.prisma.aiUserPolicy.findUnique({
      where: { userId },
    });

    return record
      ? {
          userId: record.userId,
          rateLimitTier: AiRateLimitTier[record.rateLimitTier],
          fallbackPolicy: AiFallbackPolicy[record.fallbackPolicy],
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }
      : null;
  }

  async userExists(userId: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { id: userId } });
    return count > 0;
  }

  async upsert(
    userId: string,
    input: UpdateAiUserPolicyInput,
  ): Promise<AiUserPolicyRecord> {
    const record = await this.prisma.aiUserPolicy.upsert({
      where: { userId },
      create: {
        userId,
        rateLimitTier:
          PrismaAiRateLimitTier[input.rateLimitTier ?? AiRateLimitTier.FREE],
        fallbackPolicy:
          PrismaAiFallbackPolicy[input.fallbackPolicy ?? AiFallbackPolicy.NONE],
      },
      update: {
        ...(input.rateLimitTier !== undefined
          ? { rateLimitTier: PrismaAiRateLimitTier[input.rateLimitTier] }
          : {}),
        ...(input.fallbackPolicy !== undefined
          ? { fallbackPolicy: PrismaAiFallbackPolicy[input.fallbackPolicy] }
          : {}),
      },
    });

    return {
      userId: record.userId,
      rateLimitTier: AiRateLimitTier[record.rateLimitTier],
      fallbackPolicy: AiFallbackPolicy[record.fallbackPolicy],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static defaultFor(userId: string): AiUserPolicyRecord {
    return { userId, ...DEFAULT_POLICY };
  }
}
