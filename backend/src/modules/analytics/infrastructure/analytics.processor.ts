import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import { AnalyticsReconciliationService } from './analytics-reconciliation.service';

interface AnalyticsBatchJob {
  eventIds: string[];
}

@Processor(QUEUE_NAMES.ANALYTICS)
@Injectable()
export class AnalyticsProcessor extends WorkerHost {
  constructor(
    private readonly aggregation: AnalyticsAggregationService,
    private readonly reconciliation: AnalyticsReconciliationService,
  ) {
    super();
  }

  async process(job: Job<AnalyticsBatchJob>): Promise<{ processed: number }> {
    if (job.name !== 'reader-analytics-batch') {
      throw new Error(`Unsupported analytics job: ${job.name}`);
    }
    const ids = Array.isArray(job.data?.eventIds)
      ? job.data.eventIds.filter((id): id is string => typeof id === 'string')
      : [];
    const processed = await this.aggregation.processEventIds(ids);
    if (processed > 0)
      await this.reconciliation.recomputeUniqueReadersForEvents(ids);
    return { processed };
  }
}
