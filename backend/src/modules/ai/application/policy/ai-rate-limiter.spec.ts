import {
  BusinessRuleViolationException,
  RateLimitExceededException,
} from '@/common/exceptions';

import { AiFallbackPolicy, AiRateLimitTier } from '../../domain/enums';
import type { AiPolicyPersistencePort } from '../ports/ai-policy.persistence.port';
import type { AiRateLimitPersistencePort } from '../ports/ai-rate-limit.persistence.port';
import { AiRateLimiter } from './ai-rate-limiter';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('AiRateLimiter', () => {
  let policies: jest.Mocked<AiPolicyPersistencePort>;
  let buckets: jest.Mocked<AiRateLimitPersistencePort>;
  let reserveBucket: jest.Mock;
  let reconcileTokens: jest.Mock;
  let service: AiRateLimiter;

  beforeEach(() => {
    policies = {
      findByUserId: jest.fn().mockResolvedValue({
        userId: USER_ID,
        rateLimitTier: AiRateLimitTier.FREE,
        fallbackPolicy: AiFallbackPolicy.NONE,
        createdAt: null,
        updatedAt: null,
      }),
      userExists: jest.fn(),
      upsert: jest.fn(),
    };
    reserveBucket = jest.fn().mockResolvedValue({
      allowed: true,
      bucket: { requestCount: 1, tokenCount: 1_030 },
    });
    reconcileTokens = jest.fn();
    buckets = {
      reserve: reserveBucket,
      reconcileTokens,
    };
    service = new AiRateLimiter(policies, buckets);
  });

  it('reserve đồng thời một request và ngân sách token đầu ra', async () => {
    const reservation = await service.reserve(USER_ID, {
      systemPrompt: 'abcd',
      messages: [{ role: 'user', content: 'abcdefgh' }],
    });

    expect(reserveBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        requestLimit: 20,
        tokenLimit: 50_000,
        requests: 1,
        tokens: 10_003,
      }),
    );
    expect(reservation?.reservedTokens).toBe(10_003);
  });

  it('reserve nhiều diagnostic request trong một thao tác atomic', async () => {
    await service.reserveExternalRequests(USER_ID, 4);

    expect(reserveBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        requestLimit: 20,
        requests: 4,
        tokens: 0,
      }),
    );
  });

  it('ném AI_RATE_LIMITED khi bucket từ chối', async () => {
    reserveBucket.mockResolvedValue({
      allowed: false,
      bucket: { requestCount: 20, tokenCount: 10_000 },
    });

    try {
      await service.reserve(USER_ID, {
        messages: [{ role: 'user', content: 'hello' }],
      });
      throw new Error('Expected rate limit rejection');
    } catch (error) {
      if (!(error instanceof RateLimitExceededException)) throw error;
      expect(error.code).toBe('AI_RATE_LIMITED');
      expect(error.details).toEqual(
        expect.objectContaining({ dimension: 'requests', tier: 'FREE' }),
      );
    }
  });

  it('chặn input vượt 10.000 token trước khi giữ quota', async () => {
    try {
      await service.reserve(USER_ID, {
        messages: [{ role: 'user', content: 'a'.repeat(40_001) }],
      });
      throw new Error('Expected input token limit rejection');
    } catch (error) {
      if (!(error instanceof BusinessRuleViolationException)) throw error;
      expect(error.details).toEqual({
        rule: 'ai.input-token-limit-exceeded',
        estimatedInputTokens: 10_001,
        maxInputTokens: 10_000,
      });
    }

    expect(policies.findByUserId.mock.calls).toHaveLength(0);
    expect(reserveBucket).not.toHaveBeenCalled();
  });

  it('chặn output vượt 10.000 token trước khi giữ quota', async () => {
    try {
      await service.reserve(USER_ID, {
        messages: [{ role: 'user', content: 'hello' }],
        maxOutputTokens: 10_001,
      });
      throw new Error('Expected output token limit rejection');
    } catch (error) {
      if (!(error instanceof BusinessRuleViolationException)) throw error;
      expect(error.details).toEqual({
        rule: 'ai.output-token-limit-exceeded',
        requestedOutputTokens: 10_001,
        maxOutputTokens: 10_000,
      });
    }

    expect(policies.findByUserId.mock.calls).toHaveLength(0);
    expect(reserveBucket).not.toHaveBeenCalled();
  });

  it('reconcile trả phần token đã reserve nhưng không dùng', async () => {
    const reservation = await service.reserve(USER_ID, {
      messages: [{ role: 'user', content: '12345678' }],
    });

    await service.reconcile(
      reservation,
      { inputTokens: 2, outputTokens: 3 },
      'ignored',
    );

    expect(reconcileTokens).toHaveBeenCalledWith(
      USER_ID,
      reservation?.windowStart,
      10_002,
      5,
    );
  });
});
