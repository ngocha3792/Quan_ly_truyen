import { AiUsageSummary } from './admin-ai-settings.models';
import {
  AI_SERIES_COLORS,
  AI_SERIES_OTHER_COLOR,
  connectionRows,
  donutGradient,
  modelLatencyRows,
  modelRequestRows,
  successRate,
  tokenSegments,
  tokensPerRequest,
} from './ai-usage.metrics';

function metrics(requests: number, tokens: number, latency: number, errorRate = 0) {
  const failed = Math.round((requests * errorRate) / 100);
  return {
    requests,
    successfulRequests: requests - failed,
    failedRequests: failed,
    inputTokens: tokens,
    outputTokens: 0,
    totalTokens: tokens,
    averageLatencyMs: latency,
    errorRate,
  };
}

function summary(
  models: readonly { model: string; requests: number; tokens: number; latency: number }[],
): AiUsageSummary {
  const requests = models.reduce((sum, item) => sum + item.requests, 0);
  const tokens = models.reduce((sum, item) => sum + item.tokens, 0);
  return {
    range: { from: '2026-09-01', to: '2026-09-30', timeZone: 'UTC' },
    totals: {
      ...metrics(requests, tokens, 100),
      successfulRequests: requests - 1,
      failedRequests: 1,
    },
    byModel: models.map((item) => ({
      model: item.model,
      protocol: null,
      ...metrics(item.requests, item.tokens, item.latency),
    })),
    byConnection: [
      { connectionId: 'a', connectionName: 'A', protocol: null, ...metrics(3, 30, 120) },
      { connectionId: 'b', connectionName: 'B', protocol: null, ...metrics(1, 10, 80) },
    ],
    quota: null,
    pricing: { status: 'NOT_CONFIGURED', currency: 'USD', estimatedCost: null },
  };
}

describe('ai usage metrics', () => {
  const usage = summary([
    { model: 'small', requests: 1, tokens: 10, latency: 50 },
    { model: 'big', requests: 3, tokens: 30, latency: 200 },
  ]);

  it('ranks models by request share, largest first', () => {
    expect(modelRequestRows(usage).map((row) => [row.label, row.display])).toEqual([
      ['big', '75%'],
      ['small', '25%'],
    ]);
  });

  it('scales latency bars against the slowest model', () => {
    expect(modelLatencyRows(usage).map((row) => [row.label, row.share])).toEqual([
      ['big', 100],
      ['small', 25],
    ]);
  });

  it('ranks connections by request share', () => {
    expect(connectionRows(usage).map((row) => [row.label, row.display])).toEqual([
      ['A', '3 yêu cầu'],
      ['B', '1 yêu cầu'],
    ]);
  });

  it('assigns series colors in fixed order and folds the tail into "Khác"', () => {
    const many = summary(
      Array.from({ length: 8 }, (_, index) => ({
        model: `m${index}`,
        requests: 1,
        tokens: 100 - index,
        latency: 10,
      })),
    );
    const segments = tokenSegments(many);
    expect(segments).toHaveLength(AI_SERIES_COLORS.length + 1);
    expect(segments.map((segment) => segment.color)).toEqual([
      ...AI_SERIES_COLORS,
      AI_SERIES_OTHER_COLOR,
    ]);
    expect(segments.at(-1)?.label).toBe('Khác');
  });

  it('keeps every model when they fit inside the series palette', () => {
    expect(tokenSegments(usage).map((segment) => segment.label)).toEqual(['big', 'small']);
  });

  it('returns no segments when nothing was recorded', () => {
    const empty = summary([]);
    expect(tokenSegments(empty)).toEqual([]);
    expect(donutGradient([])).toContain('conic-gradient');
  });

  it('leaves a surface gap between adjacent donut slices', () => {
    const gradient = donutGradient(tokenSegments(usage));
    expect(gradient.startsWith('conic-gradient(')).toBe(true);
    expect(gradient).toContain('var(--surface-card-solid)');
    expect(gradient).toContain('100%)');
  });

  it('derives tokens per request and success rate from totals', () => {
    expect(tokensPerRequest(usage)).toBe(10);
    expect(successRate(usage)).toBe(75);
  });

  it('avoids dividing by zero when there is no traffic', () => {
    const empty = summary([]);
    expect(tokensPerRequest(empty)).toBe(0);
    expect(successRate(empty)).toBe(0);
  });
});
