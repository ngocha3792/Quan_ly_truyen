import { Inject, Injectable } from '@nestjs/common';
import type { ReaderAnalyticsIngestionResult } from '../../dto';
import {
  READER_ANALYTICS_INGESTION_PORT,
  type ReaderAnalyticsIngestionPort,
} from '../../ports';
import { IngestReaderAnalyticsCommand } from './ingest-reader-analytics.command';
@Injectable()
export class IngestReaderAnalyticsCommandHandler {
  constructor(
    @Inject(READER_ANALYTICS_INGESTION_PORT)
    private readonly ingestion: ReaderAnalyticsIngestionPort,
  ) {}
  execute(
    command: IngestReaderAnalyticsCommand,
  ): Promise<ReaderAnalyticsIngestionResult> {
    return this.ingestion.ingest(command.input);
  }
}
