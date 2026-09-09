import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import searchConfig from '@/config/search.config';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  isSearchDocumentChanged,
  SEARCH_DOCUMENT_CHANGED,
  SEARCH_INDEX_TICK,
  type OutboxQueueEnvelope,
} from '@/infrastructure/queue/contracts';
import { SearchIndexCoordinator } from '../persistence/search-index.coordinator';

@Processor(QUEUE_NAMES.SEARCH, { concurrency: 1 })
export class SearchIndexProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly coordinator: SearchIndexCoordinator,
    @InjectQueue(QUEUE_NAMES.SEARCH) private readonly queue: Queue,
    @Inject(searchConfig.KEY)
    private readonly config: ConfigType<typeof searchConfig>,
  ) {
    super();
  }
  async onModuleInit(): Promise<void> {
    if (this.config.enabled)
      await this.queue.upsertJobScheduler(
        'search-index-maintenance',
        { every: 5000 },
        { name: SEARCH_INDEX_TICK, data: { version: 1 } },
      );
  }
  async process(job: Job<OutboxQueueEnvelope<unknown>>): Promise<void> {
    if (job.name === SEARCH_INDEX_TICK) return this.coordinator.tick();
    if (
      job.name !== SEARCH_DOCUMENT_CHANGED ||
      !isSearchDocumentChanged(job.data.payload)
    )
      throw new UnrecoverableError('Invalid search outbox payload');
    await this.coordinator.tick(job.data.outboxEventId);
  }
}
