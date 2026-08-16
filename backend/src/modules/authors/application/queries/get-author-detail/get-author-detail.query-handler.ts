import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthorDetailDto } from '../../dto';
import { AuthorDetailMapper } from '../../mappers';
import {
  AUTHOR_PERSISTENCE_PORT,
  type AuthorPersistencePort,
} from '../../ports';

import { GetAuthorDetailQuery } from './get-author-detail.query';

@Injectable()
export class GetAuthorDetailQueryHandler {
  constructor(
    @Inject(AUTHOR_PERSISTENCE_PORT)
    private readonly persistence: AuthorPersistencePort,
  ) {}

  async execute(query: GetAuthorDetailQuery): Promise<AuthorDetailDto> {
    const author = await this.persistence.findAuthorBySlug(query.slug);

    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const recentChapters = await this.persistence.findRecentChaptersByAuthor(
      author.userId,
      5,
    );

    return AuthorDetailMapper.toDto(author, recentChapters);
  }
}
