import { RateLimitExceededException } from '@/common/exceptions';

import { AiFallbackPolicy, AiRateLimitTier } from '../../domain/enums';
import type { AiPolicyPersistencePort } from '../ports/ai-policy.persistence.port';
import type { AiRateLimitPersistencePort } from '../ports/ai-rate-limit.persistence.port';
import { AiRateLimiter } from './ai-rate-limiter';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('AiRateLimiter', () => {
  let policies: jest.Mocked<AiPolicyPersistencePort>;
  let buckets: jest.Mocked<AiRateLimitPersistencePort>;
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
    buckets = {
      reserve: jest.fn().mockResolvedValue({
        allowed: true,
        bucket: { requestCount: 1, tokenCount: 1_030 },
      }),
      reconcileTokens: jest.fn(),
    };
    service = new AiRateLimiter(policies, buckets);
  });

  it('reserve đồng thời một request và ngân sách token đầu ra', async () => {
    const reservation = await service.reserve(USER_ID, {
      systemPrompt: 'abcd',
      messages: [{ role: 'user', content: 'abcdefgh' }],
    });

    expect(buckets.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        requestLimit: 20,
        tokenLimit: 50_000,
        tokens: 1_027,
      }),
    );
    expect(reservation?.reservedTokens).toBe(1_027);
  });

  it('ném AI_RATE_LIMITED khi bucket từ chối', async () => {
    buckets.reserve.mockResolvedValue({
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

  it('reconcile trả phần token đã reserve nhưng không dùng', async () => {
    const reservation = await service.reserve(USER_ID, {
      messages: [{ role: 'user', content: '12345678' }],
    });

    await service.reconcile(
      reservation,
      { inputTokens: 2, outputTokens: 3 },
      'ignored',
    );

    expect(buckets.reconcileTokens).toHaveBeenCalledWith(
      USER_ID,
      reservation?.windowStart,
      1_026,
      5,
    );
  });
});
