import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { ObservabilityModule } from '@/infrastructure/observability';
import { SEARCH_ENGINE_PORT } from './application/ports/search.port';
import { MeilisearchAdapter } from './infrastructure/meilisearch/meilisearch.adapter';
import { SearchSourceRepository } from './infrastructure/persistence/search-source.repository';
import { SearchIndexCoordinator } from './infrastructure/persistence/search-index.coordinator';
import { SearchMetricsAdapter } from './infrastructure/metrics/search-metrics.adapter';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  providers: [
    MeilisearchAdapter,
    SearchSourceRepository,
    SearchIndexCoordinator,
    SearchMetricsAdapter,
    { provide: SEARCH_ENGINE_PORT, useExisting: MeilisearchAdapter },
  ],
  exports: [
    SEARCH_ENGINE_PORT,
    SearchSourceRepository,
    SearchIndexCoordinator,
    SearchMetricsAdapter,
  ],
})
export class SearchCoreModule {}
