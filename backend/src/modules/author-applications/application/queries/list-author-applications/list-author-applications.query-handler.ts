import { Inject, Injectable } from '@nestjs/common';

import type { AuthorApplicationListResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { ListAuthorApplicationsQuery } from './list-author-applications.query';

@Injectable()
export class ListAuthorApplicationsQueryHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,
  ) {}

  async execute(
    query: ListAuthorApplicationsQuery,
  ): Promise<AuthorApplicationListResultDto> {
    const limit = Math.min(
      100,

      Math.max(
        1,

        query.limit,
      ),
    );

    const offset = Math.max(
      0,

      query.offset,
    );

    const result = await this.persistence.list({
      status: query.status,

      limit,

      offset,
    });

    return {
      total: result.total,

      applications: result.applications.map((application) =>
        AuthorApplicationResultMapper.toDto(application),
      ),
    };
  }
}
