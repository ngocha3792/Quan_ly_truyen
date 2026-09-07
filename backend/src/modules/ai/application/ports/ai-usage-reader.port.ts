import type { AiProtocol, AiRateLimitTier } from '../../domain/enums';

export const AI_USAGE_READER_PORT = Symbol.for('modules.ai.usage-reader');

export interface AiUsageMetrics {
  readonly requests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly averageLatencyMs: number;
  readonly errorRate: number;
}

export interface AiUsageModelStats extends AiUsageMetrics {
  readonly model: string;
  readonly protocol: AiProtocol | null;
}

export interface AiUsageConnectionStats extends AiUsageMetrics {
  readonly connectionId: string | null;
  readonly connectionName: string;
  readonly protocol: AiProtocol | null;
}

export interface AiUsageQuotaSnapshot {
  readonly tier: AiRateLimitTier;
  readonly windowStart: string;
  readonly resetsAt: string;
  readonly requests: {
    readonly used: number;
    readonly limit: number;
    readonly remaining: number;
  };
  readonly tokens: {
    readonly used: number;
    readonly limit: number;
    readonly remaining: number;
  };
}

export interface AiUsageSummary {
  readonly range: {
    readonly from: string;
    readonly to: string;
    readonly timeZone: 'UTC';
  };
  readonly totals: AiUsageMetrics;
  readonly byModel: readonly AiUsageModelStats[];
  readonly byConnection: readonly AiUsageConnectionStats[];
  readonly quota: AiUsageQuotaSnapshot | null;
  readonly pricing: {
    readonly status: 'NOT_CONFIGURED';
    readonly currency: 'USD';
    readonly estimatedCost: null;
  };
}

export interface ReadAiUsageSummaryInput {
  /** Undefined means all users and is reserved for the admin endpoint. */
  readonly scopeUserId?: string;
  readonly quotaUserId?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface AiUsageReaderPort {
  summary(input: ReadAiUsageSummaryInput): Promise<AiUsageSummary>;
}
