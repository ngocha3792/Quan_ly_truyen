import { Inject, Injectable } from '@nestjs/common';
import {
  AUTHOR_ANALYTICS_READER_PORT,
  type AuthorAnalyticsReaderPort,
} from '../../ports';
import { ListAuthorStoryAnalyticsQuery } from './list-author-story-analytics.query';
@Injectable()
export class ListAuthorStoryAnalyticsQueryHandler {
  constructor(
    @Inject(AUTHOR_ANALYTICS_READER_PORT)
    private readonly reader: AuthorAnalyticsReaderPort,
  ) {}
  execute(query: ListAuthorStoryAnalyticsQuery) {
    return this.reader.stories(query.userId, query.input);
  }
}
