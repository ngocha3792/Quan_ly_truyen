import type { ReaderAnalyticsIngestionInput, ReaderAnalyticsIngestionResult } from '../dto';
export interface ReaderAnalyticsIngestionPort { ingest(input:ReaderAnalyticsIngestionInput):Promise<ReaderAnalyticsIngestionResult>; }
export const READER_ANALYTICS_INGESTION_PORT=Symbol('READER_ANALYTICS_INGESTION_PORT');
