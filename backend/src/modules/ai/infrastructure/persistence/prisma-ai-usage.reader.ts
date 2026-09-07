import { Injectable } from '@nestjs/common';

import { InvalidInputException } from '@/common/exceptions';
import {
  AiProtocol as PrismaAiProtocol,
  AiRateLimitTier as PrismaAiRateLimitTier,
  Prisma,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import { AI_TIER_LIMITS } from '../../application/constants/ai-rate-limit.constants';
import {
  AiUsageConnectionStats,
  AiUsageMetrics,
  AiUsageModelStats,
  AiUsageQuotaSnapshot,
  AiUsageReaderPort,
  AiUsageSummary,
  ReadAiUsageSummaryInput,
} from '../../application/ports/ai-usage-reader.port';
import {
  aiRateLimitResetAt,
  aiRateLimitWindowStart,
} from '../../application/policy';
import { AiProtocol, AiRateLimitTier } from '../../domain/enums';

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 365;
const MAX_BREAKDOWN_ITEMS = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

interface MutableMetrics {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  latencyTotalMs: number;
}

interface AggregateValues {
  readonly success: boolean;
  readonly _count: { readonly _all: number };
  readonly _sum: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly latencyMs: number | null;
  };
}

@Injectable()
export class PrismaAiUsageReader implements AiUsageReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async summary(input: ReadAiUsageSummaryInput): Promise<AiUsageSummary> {
    const range = this.resolveRange(input.from, input.to);
    const where: Prisma.AiUsageWhereInput = {
      createdAt: { gte: range.from, lt: range.toExclusive },
      ...(input.scopeUserId ? { userId: input.scopeUserId } : {}),
    };

    const [totalRows, modelRows, connectionRows] = await Promise.all([
      this.prisma.aiUsage.groupBy({
        by: ['success'],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, latencyMs: true },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['model', 'protocol', 'success'],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, latencyMs: true },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['connectionId', 'protocol', 'success'],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, latencyMs: true },
      }),
    ]);

    const connectionIds = [
      ...new Set(
        connectionRows
          .map((row) => row.connectionId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const connections = connectionIds.length
      ? await this.prisma.aiConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, userId: true, name: true },
        })
      : [];
    const connectionNames = new Map(
      connections.map((connection) => [
        connection.id,
        input.scopeUserId && connection.userId === null
          ? 'Kết nối hệ thống'
          : connection.name,
      ]),
    );

    const byModel = this.modelStats(modelRows);
    const byConnection = this.connectionStats(connectionRows, connectionNames);
    const quota = input.quotaUserId
      ? await this.quota(input.quotaUserId)
      : null;

    return {
      range: {
        from: range.fromKey,
        to: range.toKey,
        timeZone: 'UTC',
      },
      totals: this.metrics(this.accumulate(totalRows)),
      byModel,
      byConnection,
      quota,
      pricing: {
        status: 'NOT_CONFIGURED',
        currency: 'USD',
        estimatedCost: null,
      },
    };
  }

  private modelStats(
    rows: readonly (AggregateValues & {
      readonly model: string;
      readonly protocol: PrismaAiProtocol | null;
    })[],
  ): readonly AiUsageModelStats[] {
    const groups = new Map<
      string,
      {
        model: string;
        protocol: AiProtocol | null;
        metrics: MutableMetrics;
      }
    >();

    for (const row of rows) {
      const protocol = this.protocol(row.protocol);
      const key = `${protocol ?? 'UNKNOWN'}\u0000${row.model}`;
      const group = groups.get(key) ?? {
        model: row.model,
        protocol,
        metrics: this.emptyMetrics(),
      };
      this.add(group.metrics, row);
      groups.set(key, group);
    }

    return [...groups.values()]
      .map((group) => ({
        model: group.model,
        protocol: group.protocol,
        ...this.metrics(group.metrics),
      }))
      .sort((left, right) =>
        right.requests !== left.requests
          ? right.requests - left.requests
          : left.model.localeCompare(right.model),
      )
      .slice(0, MAX_BREAKDOWN_ITEMS);
  }

  private connectionStats(
    rows: readonly (AggregateValues & {
      readonly connectionId: string | null;
      readonly protocol: PrismaAiProtocol | null;
    })[],
    names: ReadonlyMap<string, string>,
  ): readonly AiUsageConnectionStats[] {
    const groups = new Map<
      string,
      {
        connectionId: string | null;
        connectionName: string;
        protocol: AiProtocol | null;
        metrics: MutableMetrics;
      }
    >();

    for (const row of rows) {
      const protocol = this.protocol(row.protocol);
      const key = row.connectionId ?? 'DELETED';
      const group = groups.get(key) ?? {
        connectionId: row.connectionId,
        connectionName: row.connectionId
          ? (names.get(row.connectionId) ?? 'Kết nối đã xóa')
          : 'Kết nối đã xóa hoặc không xác định',
        protocol,
        metrics: this.emptyMetrics(),
      };
      if (group.protocol !== protocol) group.protocol = null;
      this.add(group.metrics, row);
      groups.set(key, group);
    }

    return [...groups.values()]
      .map((group) => ({
        connectionId: group.connectionId,
        connectionName: group.connectionName,
        protocol: group.protocol,
        ...this.metrics(group.metrics),
      }))
      .sort((left, right) =>
        right.requests !== left.requests
          ? right.requests - left.requests
          : left.connectionName.localeCompare(right.connectionName),
      )
      .slice(0, MAX_BREAKDOWN_ITEMS);
  }

  private async quota(userId: string): Promise<AiUsageQuotaSnapshot> {
    const policy = await this.prisma.aiUserPolicy.findUnique({
      where: { userId },
      select: { rateLimitTier: true },
    });
    const tier = this.tier(policy?.rateLimitTier);
    const limits = AI_TIER_LIMITS[tier];
    const windowStart = aiRateLimitWindowStart(
      new Date(),
      limits.windowSeconds,
    );
    const bucket = await this.prisma.aiRateLimitBucket.findUnique({
      where: { userId_windowStart: { userId, windowStart } },
      select: { requestCount: true, tokenCount: true },
    });
    const usedRequests = bucket?.requestCount ?? 0;
    const usedTokens = bucket?.tokenCount ?? 0;

    return {
      tier,
      windowStart: windowStart.toISOString(),
      resetsAt: aiRateLimitResetAt(
        windowStart,
        limits.windowSeconds,
      ).toISOString(),
      requests: {
        used: usedRequests,
        limit: limits.requests,
        remaining: Math.max(0, limits.requests - usedRequests),
      },
      tokens: {
        used: usedTokens,
        limit: limits.tokens,
        remaining: Math.max(0, limits.tokens - usedTokens),
      },
    };
  }

  private resolveRange(from?: string, to?: string) {
    const today = this.utcDate(new Date());
    const toDate = to ? this.parseDate(to) : today;
    const fromDate = from
      ? this.parseDate(from)
      : new Date(toDate.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
    const days =
      Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
    if (days < 1 || days > MAX_RANGE_DAYS) {
      throw new InvalidInputException({
        code: 'AI_USAGE_INVALID_DATE_RANGE',
        message: 'Khoảng thống kê AI phải từ 1 đến 365 ngày.',
      });
    }

    return {
      from: fromDate,
      toExclusive: new Date(toDate.getTime() + DAY_MS),
      fromKey: this.dateKey(fromDate),
      toKey: this.dateKey(toDate),
    };
  }

  private parseDate(value: string): Date {
    if (!DATE_PATTERN.test(value)) return this.invalidDate();
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || this.dateKey(parsed) !== value) {
      return this.invalidDate();
    }
    return parsed;
  }

  private invalidDate(): never {
    throw new InvalidInputException({
      code: 'AI_USAGE_INVALID_DATE_RANGE',
      message: 'Ngày thống kê AI không hợp lệ.',
    });
  }

  private utcDate(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private dateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private accumulate(rows: readonly AggregateValues[]): MutableMetrics {
    const result = this.emptyMetrics();
    for (const row of rows) this.add(result, row);
    return result;
  }

  private add(target: MutableMetrics, row: AggregateValues): void {
    const requests = row._count._all;
    target.requests += requests;
    target.successfulRequests += row.success ? requests : 0;
    target.failedRequests += row.success ? 0 : requests;
    target.inputTokens += row._sum.inputTokens ?? 0;
    target.outputTokens += row._sum.outputTokens ?? 0;
    target.latencyTotalMs += row._sum.latencyMs ?? 0;
  }

  private emptyMetrics(): MutableMetrics {
    return {
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
      latencyTotalMs: 0,
    };
  }

  private metrics(value: MutableMetrics): AiUsageMetrics {
    return {
      requests: value.requests,
      successfulRequests: value.successfulRequests,
      failedRequests: value.failedRequests,
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
      totalTokens: value.inputTokens + value.outputTokens,
      averageLatencyMs:
        value.requests > 0
          ? Math.round(value.latencyTotalMs / value.requests)
          : 0,
      errorRate:
        value.requests > 0
          ? Math.round((value.failedRequests / value.requests) * 10_000) / 100
          : 0,
    };
  }

  private protocol(value: PrismaAiProtocol | null): AiProtocol | null {
    switch (value) {
      case PrismaAiProtocol.OPENAI_RESPONSES:
        return AiProtocol.OPENAI_RESPONSES;
      case PrismaAiProtocol.OPENAI_CHAT_COMPLETIONS:
        return AiProtocol.OPENAI_CHAT_COMPLETIONS;
      case PrismaAiProtocol.ANTHROPIC_MESSAGES:
        return AiProtocol.ANTHROPIC_MESSAGES;
      case PrismaAiProtocol.GEMINI_GENERATE_CONTENT:
        return AiProtocol.GEMINI_GENERATE_CONTENT;
      case null:
        return null;
    }
  }

  private tier(value: PrismaAiRateLimitTier | undefined): AiRateLimitTier {
    switch (value) {
      case PrismaAiRateLimitTier.PRO:
        return AiRateLimitTier.PRO;
      case PrismaAiRateLimitTier.ENTERPRISE:
        return AiRateLimitTier.ENTERPRISE;
      case PrismaAiRateLimitTier.FREE:
      case undefined:
        return AiRateLimitTier.FREE;
    }
  }
}
