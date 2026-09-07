import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  RateLimitExceededException,
} from '@/common/exceptions';

import { AiRateLimitTier } from '../../domain/enums';
import {
  AI_APPROXIMATE_CHARACTERS_PER_TOKEN,
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_OUTPUT_TOKENS,
} from '../constants/ai-generation.constants';
import { AI_TIER_LIMITS } from '../constants/ai-rate-limit.constants';
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
} from '../ports/ai-protocol-adapter.port';
import {
  aiRateLimitResetAt,
  aiRateLimitWindowStart,
} from './ai-rate-limit-window.util';
import { normalizeAiUsageToken } from '../usage';

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
    const estimatedInputTokens = this.estimateInputTokens(request);
    if (estimatedInputTokens > AI_MAX_INPUT_TOKENS) {
      throw new BusinessRuleViolationException({
        message:
          'Nội dung gửi lên vượt quá giới hạn 10.000 input token. Hãy rút gọn nội dung hoặc system prompt.',
        rule: 'ai.input-token-limit-exceeded',
        details: {
          estimatedInputTokens,
          maxInputTokens: AI_MAX_INPUT_TOKENS,
        },
      });
    }

    const requestedOutputTokens =
      request.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS;
    if (
      !Number.isSafeInteger(requestedOutputTokens) ||
      requestedOutputTokens <= 0 ||
      requestedOutputTokens > AI_MAX_OUTPUT_TOKENS
    ) {
      throw new BusinessRuleViolationException({
        message:
          'Output token phải là số nguyên dương và không vượt quá 10.000 token.',
        rule: 'ai.output-token-limit-exceeded',
        details: {
          requestedOutputTokens,
          maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        },
      });
    }

    if (!userId) return null;

    const policy = await this.policies.findByUserId(userId);
    const tier = policy?.rateLimitTier ?? AiRateLimitTier.FREE;
    const limits = AI_TIER_LIMITS[tier];
    const reservedTokens = estimatedInputTokens + requestedOutputTokens;
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
      requests: 1,
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

  async reserveExternalRequests(
    userId: string | null,
    requests: number,
  ): Promise<void> {
    if (!userId) return;
    if (!Number.isSafeInteger(requests) || requests <= 0) {
      throw new BusinessRuleViolationException({
        message: 'Chi phí request AI không hợp lệ.',
        rule: 'ai.external-request-cost-invalid',
      });
    }

    const policy = await this.policies.findByUserId(userId);
    const tier = policy?.rateLimitTier ?? AiRateLimitTier.FREE;
    const limits = AI_TIER_LIMITS[tier];
    const windowStart = this.windowStart(limits.windowSeconds);
    const retryAfterSeconds = this.retryAfterSeconds(
      windowStart,
      limits.windowSeconds,
    );

    if (requests > limits.requests) {
      this.logRejection(userId, tier, 'requests', limits.requests);
      throw this.exceeded(tier, limits.requests, retryAfterSeconds, 'requests');
    }

    const result = await this.buckets.reserve({
      userId,
      windowStart,
      requestLimit: limits.requests,
      tokenLimit: limits.tokens,
      requests,
      tokens: 0,
    });

    if (!result.allowed) {
      const dimension =
        result.bucket.requestCount + requests > limits.requests
          ? 'requests'
          : 'tokens';
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

    const inputTokens = normalizeAiUsageToken(usage?.inputTokens);
    const outputTokens = normalizeAiUsageToken(usage?.outputTokens);
    const actualTokens =
      inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? reservation.estimatedInputTokens) +
          (outputTokens ?? this.estimateTextTokens(outputText))
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
    return Math.max(
      1,
      Math.ceil(characters / AI_APPROXIMATE_CHARACTERS_PER_TOKEN),
    );
  }

  private estimateTextTokens(value: string): number {
    return value
      ? Math.max(
          1,
          Math.ceil(value.length / AI_APPROXIMATE_CHARACTERS_PER_TOKEN),
        )
      : 0;
  }

  private windowStart(windowSeconds: number): Date {
    return aiRateLimitWindowStart(new Date(), windowSeconds);
  }

  private retryAfterSeconds(windowStart: Date, windowSeconds: number): number {
    const resetAt = aiRateLimitResetAt(windowStart, windowSeconds).getTime();
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
