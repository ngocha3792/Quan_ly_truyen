import { Inject, Injectable } from '@nestjs/common';
import {
  AUTHOR_ANALYTICS_READER_PORT,
  type AuthorAnalyticsReaderPort,
} from '../../ports';
import { GetAuthorAnalyticsOverviewQuery } from './get-author-analytics-overview.query';
@Injectable()
export class GetAuthorAnalyticsOverviewQueryHandler {
  constructor(
    @Inject(AUTHOR_ANALYTICS_READER_PORT)
    private readonly reader: AuthorAnalyticsReaderPort,
  ) {}
  execute(query: GetAuthorAnalyticsOverviewQuery) {
    return this.reader.overview(query.userId, query.from, query.to);
  }
}
