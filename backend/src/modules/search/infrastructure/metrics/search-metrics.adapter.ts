import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import { MetricsService, METRIC_NAMES } from '@/infrastructure/observability';

@Injectable()
export class SearchMetricsAdapter {
  private readonly queries: Counter<'engine' | 'empty_query' | 'empty_results'>;
  private readonly latency: Histogram<'engine'>;
  private readonly failures: Counter;
  private readonly lag: Gauge;
  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];
    this.queries = new Counter({
      name: METRIC_NAMES.SEARCH_QUERIES,
      help: 'Search queries without storing user text',
      labelNames: ['engine', 'empty_query', 'empty_results'],
      registers,
    });
    this.latency = new Histogram({
      name: METRIC_NAMES.SEARCH_DURATION,
      help: 'End-to-end search latency, including hydration',
      labelNames: ['engine'],
      buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers,
    });
    this.failures = new Counter({
      name: METRIC_NAMES.SEARCH_FAILED_DOCUMENTS,
      help: 'Documents in failed indexing attempts',
      registers,
    });
    this.lag = new Gauge({
      name: METRIC_NAMES.SEARCH_INDEX_LAG,
      help: 'Age of oldest unindexed document change; zero when caught up',
      registers,
    });
  }
  query(engine: string, empty: boolean, count: number, ms: number): void {
    this.queries.inc({
      engine,
      empty_query: String(empty),
      empty_results: String(count === 0),
    });
    this.latency.observe({ engine }, ms / 1000);
  }
  failed(count: number): void {
    this.failures.inc(count);
  }
  snapshot(oldest: Date | null, failedDocuments: number): void {
    this.backlog(oldest);
    this.failures.reset();
    this.failures.inc(failedDocuments);
  }
  backlog(oldest: Date | null): void {
    this.lag.set(
      oldest ? Math.max(0, (Date.now() - oldest.getTime()) / 1000) : 0,
    );
  }
}
