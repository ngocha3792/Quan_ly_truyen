import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  RECOMMENDATION_PORT,
  type RecommendationPort,
} from '../../application';
import { Inject } from '@nestjs/common';

const JOB_NAME = 'calculate-item-similarity';

@Injectable()
@Processor(QUEUE_NAMES.RECOMMENDATION, { concurrency: 1 })
export class RecommendationSimilarityProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    @Inject(RECOMMENDATION_PORT)
    private readonly recommendations: RecommendationPort,
    @InjectQueue(QUEUE_NAMES.RECOMMENDATION) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'recommendation-nightly',
      { pattern: '0 2 * * *' },
      {
        name: JOB_NAME,
        data: { modelVersion: 'item-item-v1' },
      },
    );
  }

  async process(job: Job<{ modelVersion?: string }>): Promise<void> {
    if (job.name !== JOB_NAME) return;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    await this.recommendations.calculateItemSimilarity(
      startDate,
      endDate,
      job.data.modelVersion ?? 'item-item-v1',
    );
  }
}
