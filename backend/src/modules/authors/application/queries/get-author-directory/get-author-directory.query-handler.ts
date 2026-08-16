import { Inject, Injectable } from '@nestjs/common';

import type { AuthorDirectoryDto } from '../../dto';
import { AuthorDirectoryMapper } from '../../mappers';
import {
  AUTHOR_PERSISTENCE_PORT,
  type AuthorPersistencePort,
} from '../../ports';

import type { GetAuthorDirectoryQuery } from './get-author-directory.query';

@Injectable()
export class GetAuthorDirectoryQueryHandler {
  constructor(
    @Inject(AUTHOR_PERSISTENCE_PORT)
    private readonly persistence: AuthorPersistencePort,
  ) {}

  async execute(_query?: GetAuthorDirectoryQuery): Promise<AuthorDirectoryDto> {
    void _query;
    const [authors, newAuthors, aggregate] = await Promise.all([
      this.persistence.findDirectoryAuthors(),
      this.persistence.findNewAuthors(5),
      this.persistence.aggregateDirectoryStats(),
    ]);

    return AuthorDirectoryMapper.toDto(authors, newAuthors, aggregate);
  }
}
