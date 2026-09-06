import { Inject, Injectable, Logger } from '@nestjs/common';

import { RateLimitExceededException } from '@/common/exceptions';

import { AiRateLimitTier } from '../../domain/enums';
import {
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_TIER_LIMITS,
} from '../constants/ai-rate-limit.constants';
import {
  AI_POLICY_PERSISTENCE_PORT,
  AiPolicyPersistencePort,
} from '../ports/ai-policy.persistence.port';
import {
  AI_RATE_LIMIT_PERSISTENCE_PORT,
  AiRateLimitPersistencePort,
} from '../ports/ai-rate-limit.persistence.port';
import type {
  AiGenerateRequest,
  AiUsageTokens,
} from '../ports/ai-provider-client.port';

export interface AiRateLimitReservation {
  readonly userId: string;
  readonly windowStart: Date;
  readonly reservedTokens: number;
  readonly estimatedInputTokens: number;
}

@Injectable()
export class AiRateLimiter {
  private readonly logger = new Logger(AiRateLimiter.name);

  constructor(
    @Inject(AI_POLICY_PERSISTENCE_PORT)
    private readonly policies: AiPolicyPersistencePort,
    @Inject(AI_RATE_LIMIT_PERSISTENCE_PORT)
    private readonly buckets: AiRateLimitPersistencePort,
  ) {}

  async reserve(
    userId: string | null,
    request: AiGenerateRequest,
  ): Promise<AiRateLimitReservation | null> {
    if (!userId) return null;

    const policy = await this.policies.findByUserId(userId);
    const tier = policy?.rateLimitTier ?? AiRateLimitTier.FREE;
    const limits = AI_TIER_LIMITS[tier];
    const estimatedInputTokens = this.estimateInputTokens(request);
    const reservedTokens =
      estimatedInputTokens +
      (request.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS);
    const windowStart = this.windowStart(limits.windowSeconds);
    const retryAfterSeconds = this.retryAfterSeconds(
      windowStart,
      limits.windowSeconds,
    );

    if (reservedTokens > limits.tokens) {
      this.logRejection(userId, tier, 'tokens', limits.tokens);
      throw this.exceeded(tier, limits.tokens, retryAfterSeconds, 'tokens');
    }

    const result = await this.buckets.reserve({
      userId,
      windowStart,
      requestLimit: limits.requests,
      tokenLimit: limits.tokens,
      tokens: reservedTokens,
    });

    if (!result.allowed) {
      const dimension =
        result.bucket.requestCount >= limits.requests ? 'requests' : 'tokens';
      this.logRejection(
        userId,
        tier,
        dimension,
        dimension === 'requests' ? limits.requests : limits.tokens,
      );
      throw this.exceeded(
        tier,
        dimension === 'requests' ? limits.requests : limits.tokens,
        retryAfterSeconds,
        dimension,
      );
    }

    return { userId, windowStart, reservedTokens, estimatedInputTokens };
  }

  private logRejection(
    userId: string,
    tier: AiRateLimitTier,
    dimension: 'requests' | 'tokens',
    limit: number,
  ): void {
    this.logger.warn({
      event: 'ai.rate-limit.rejected',
      userId,
      tier,
      dimension,
      limit,
    });
  }

  async reconcile(
    reservation: AiRateLimitReservation | null,
    usage: AiUsageTokens | undefined,
    outputText: string,
  ): Promise<void> {
    if (!reservation) return;

    const actualTokens =
      usage?.inputTokens !== undefined || usage?.outputTokens !== undefined
        ? (usage.inputTokens ?? reservation.estimatedInputTokens) +
          (usage.outputTokens ?? this.estimateTextTokens(outputText))
        : reservation.estimatedInputTokens +
          this.estimateTextTokens(outputText);

    try {
      await this.buckets.reconcileTokens(
        reservation.userId,
        reservation.windowStart,
        reservation.reservedTokens,
        actualTokens,
      );
    } catch {
      // Keep the conservative reservation if reconciliation is unavailable.
    }
  }

  private estimateInputTokens(request: AiGenerateRequest): number {
    const characters =
      (request.systemPrompt?.length ?? 0) +
      request.messages.reduce(
        (total, message) => total + message.content.length,
        0,
      );
    return Math.max(1, Math.ceil(characters / 4));
  }

  private estimateTextTokens(value: string): number {
    return value ? Math.max(1, Math.ceil(value.length / 4)) : 0;
  }

  private windowStart(windowSeconds: number): Date {
    const windowMs = windowSeconds * 1_000;
    return new Date(Math.floor(Date.now() / windowMs) * windowMs);
  }

  private retryAfterSeconds(windowStart: Date, windowSeconds: number): number {
    const resetAt = windowStart.getTime() + windowSeconds * 1_000;
    return Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
  }

  private exceeded(
    tier: AiRateLimitTier,
    limit: number,
    retryAfterSeconds: number,
    dimension: 'requests' | 'tokens',
  ): RateLimitExceededException {
    return new RateLimitExceededException({
      code: 'AI_RATE_LIMITED',
      message:
        dimension === 'requests'
          ? 'Bạn đã dùng hết số lượt AI trong khung giờ hiện tại.'
          : 'Bạn đã dùng hết hạn mức token AI trong khung giờ hiện tại.',
      retryAfterSeconds,
      limit,
      details: { scope: 'ai', tier, dimension },
    });
  }
}
