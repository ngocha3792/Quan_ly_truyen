import {
  AiProtocol as PrismaAiProtocol,
  AiRateLimitTier as PrismaAiRateLimitTier,
} from '@/generated/prisma/client';

import { PrismaAiUsageReader } from './prisma-ai-usage.reader';

describe('PrismaAiUsageReader', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T12:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('tổng hợp token, latency, error rate theo model/kết nối và quota', async () => {
    const success = {
      success: true,
      _count: { _all: 2 },
      _sum: { inputTokens: 500_000, outputTokens: 80_000, latencyMs: 600 },
    };
    const failure = {
      success: false,
      _count: { _all: 1 },
      _sum: { inputTokens: null, outputTokens: null, latencyMs: 300 },
    };
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([success, failure])
      .mockResolvedValueOnce([
        {
          ...success,
          model: 'sonnet-5',
          protocol: PrismaAiProtocol.ANTHROPIC_MESSAGES,
        },
        {
          ...failure,
          model: 'sonnet-5',
          protocol: PrismaAiProtocol.ANTHROPIC_MESSAGES,
        },
      ])
      .mockResolvedValueOnce([
        {
          ...success,
          connectionId: 'connection-id',
          protocol: PrismaAiProtocol.ANTHROPIC_MESSAGES,
        },
        {
          ...failure,
          connectionId: 'connection-id',
          protocol: PrismaAiProtocol.OPENAI_CHAT_COMPLETIONS,
        },
      ]);
    const reader = new PrismaAiUsageReader({
      aiUsage: { groupBy },
      aiConnection: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'connection-id', userId: 'user-id', name: 'Claude riêng' },
          ]),
      },
      aiUserPolicy: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ rateLimitTier: PrismaAiRateLimitTier.PRO }),
      },
      aiRateLimitBucket: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ requestCount: 7, tokenCount: 580_000 }),
      },
    } as never);

    const result = await reader.summary({
      scopeUserId: 'user-id',
      quotaUserId: 'user-id',
    });

    expect(result.range).toEqual({
      from: '2026-08-09',
      to: '2026-09-07',
      timeZone: 'UTC',
    });
    expect(result.totals).toEqual({
      requests: 3,
      successfulRequests: 2,
      failedRequests: 1,
      inputTokens: 500_000,
      outputTokens: 80_000,
      totalTokens: 580_000,
      averageLatencyMs: 300,
      errorRate: 33.33,
    });
    expect(result.byModel[0]).toMatchObject({
      model: 'sonnet-5',
      requests: 3,
      errorRate: 33.33,
    });
    expect(result.byConnection[0]).toMatchObject({
      connectionName: 'Claude riêng',
      requests: 3,
      protocol: null,
    });
    expect(result.byConnection).toHaveLength(1);
    expect(result.quota).toMatchObject({
      tier: 'PRO',
      requests: { used: 7 },
      tokens: { used: 580_000 },
    });
    expect(result.pricing).toEqual({
      status: 'NOT_CONFIGURED',
      currency: 'USD',
      estimatedCost: null,
    });
  });

  it('từ chối date range lớn hơn 365 ngày trước khi query database', async () => {
    const groupBy = jest.fn();
    const reader = new PrismaAiUsageReader({ aiUsage: { groupBy } } as never);

    await expect(
      reader.summary({ from: '2025-01-01', to: '2026-09-07' }),
    ).rejects.toMatchObject({ code: 'AI_USAGE_INVALID_DATE_RANGE' });
    expect(groupBy).not.toHaveBeenCalled();
  });
});
