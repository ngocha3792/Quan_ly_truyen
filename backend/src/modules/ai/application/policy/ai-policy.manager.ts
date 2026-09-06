import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import { AiFallbackPolicy, AiRateLimitTier } from '../../domain/enums';
import {
  AI_TIER_LIMITS,
  AiTierLimit,
} from '../constants/ai-rate-limit.constants';
import {
  AI_POLICY_PERSISTENCE_PORT,
  AiPolicyPersistencePort,
  AiUserPolicyRecord,
} from '../ports/ai-policy.persistence.port';

export interface AiPolicyView {
  readonly userId: string;
  readonly rateLimitTier: AiRateLimitTier;
  readonly fallbackPolicy: AiFallbackPolicy;
  readonly limits: AiTierLimit;
  readonly updatedAt: Date | null;
}

export interface UpdateAiPolicyInput {
  readonly rateLimitTier?: AiRateLimitTier;
  readonly fallbackPolicy?: AiFallbackPolicy;
}

@Injectable()
export class AiPolicyManager {
  constructor(
    @Inject(AI_POLICY_PERSISTENCE_PORT)
    private readonly policies: AiPolicyPersistencePort,
  ) {}

  async get(userId: string): Promise<AiPolicyView> {
    const policy = await this.policies.findByUserId(userId);
    if (policy) return this.toView(policy);

    if (!(await this.policies.userExists(userId))) {
      throw new ResourceNotFoundException({
        resource: 'người dùng',
        identifier: userId,
      });
    }

    return this.toView({
      userId,
      rateLimitTier: AiRateLimitTier.FREE,
      fallbackPolicy: AiFallbackPolicy.NONE,
      createdAt: null,
      updatedAt: null,
    });
  }

  async update(
    userId: string,
    input: UpdateAiPolicyInput,
  ): Promise<AiPolicyView> {
    if (!(await this.policies.userExists(userId))) {
      throw new ResourceNotFoundException({
        resource: 'người dùng',
        identifier: userId,
      });
    }

    return this.toView(await this.policies.upsert(userId, input));
  }

  private toView(policy: AiUserPolicyRecord): AiPolicyView {
    return {
      userId: policy.userId,
      rateLimitTier: policy.rateLimitTier,
      fallbackPolicy: policy.fallbackPolicy,
      limits: AI_TIER_LIMITS[policy.rateLimitTier],
      updatedAt: policy.updatedAt,
    };
  }
}
