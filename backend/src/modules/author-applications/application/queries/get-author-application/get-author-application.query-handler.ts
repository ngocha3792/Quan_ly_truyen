import { Inject, Injectable } from '@nestjs/common';

import { AuthorApplicationNotFoundException } from '../../../domain';

import type { AuthorApplicationResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { GetAuthorApplicationQuery } from './get-author-application.query';

@Injectable()
export class GetAuthorApplicationQueryHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,
  ) {}

  async execute(
    query: GetAuthorApplicationQuery,
  ): Promise<AuthorApplicationResultDto> {
    const application = await this.persistence.findById(query.applicationId);

    if (!application) {
      throw new AuthorApplicationNotFoundException(query.applicationId);
    }

    return AuthorApplicationResultMapper.toDto(application);
  }
}
