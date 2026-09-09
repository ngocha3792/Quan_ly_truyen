import { Module } from '@nestjs/common';
import { SearchCoreModule } from './search-core.module';
import { SearchIndexProcessor } from './infrastructure/queue/search-index.processor';

@Module({ imports: [SearchCoreModule], providers: [SearchIndexProcessor] })
export class SearchWorkerModule {}
