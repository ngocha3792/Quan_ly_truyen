import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { SearchCoreModule } from './search-core.module';
import { SearchMetricsObserver } from './infrastructure/metrics/search-metrics.observer';
import {
  SEARCH_ADMIN_PORT,
  SEARCH_QUERY_PORT,
} from './application/ports/search.port';
import { SearchQueryAdapter } from './infrastructure/search-query.adapter';
import { SearchIndexCoordinator } from './infrastructure/persistence/search-index.coordinator';
import { SearchQueryHandler } from './application/queries/search.query-handler';
import { RebuildSearchCommandHandler } from './application/commands/rebuild-search.command-handler';
import {
  AdminSearchController,
  SearchController,
} from './presentation/http/controllers/search.controller';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, SearchCoreModule],
  controllers: [SearchController, AdminSearchController],
  providers: [
    SearchMetricsObserver,
    SearchQueryAdapter,
    SearchQueryHandler,
    RebuildSearchCommandHandler,
    { provide: SEARCH_QUERY_PORT, useExisting: SearchQueryAdapter },
    { provide: SEARCH_ADMIN_PORT, useExisting: SearchIndexCoordinator },
  ],
})
export class SearchModule {}
