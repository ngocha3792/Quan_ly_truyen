import { Inject, Injectable } from '@nestjs/common';
import {
  AUTHOR_ANALYTICS_READER_PORT,
  type AuthorAnalyticsReaderPort,
} from '../../ports';
import { GetAuthorStoryAnalyticsQuery } from './get-author-story-analytics.query';
@Injectable()
export class GetAuthorStoryAnalyticsQueryHandler {
  constructor(
    @Inject(AUTHOR_ANALYTICS_READER_PORT)
    private readonly reader: AuthorAnalyticsReaderPort,
  ) {}
  execute(query: GetAuthorStoryAnalyticsQuery) {
    return this.reader.story(query.userId, query.storyId, query.from, query.to);
  }
}
