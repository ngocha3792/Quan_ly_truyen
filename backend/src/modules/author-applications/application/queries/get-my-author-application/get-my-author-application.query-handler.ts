import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { AuthorApplicationResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { GetMyAuthorApplicationQuery } from './get-my-author-application.query';

@Injectable()
export class GetMyAuthorApplicationQueryHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,
  ) {}

  async execute(
    query: GetMyAuthorApplicationQuery,
  ): Promise<AuthorApplicationResultDto | null> {
    if (!query.userId || !isUuidV4(query.userId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTHOR_APPLICATION_AUTHENTICATION_REQUIRED',

        message: 'Bạn cần đăng nhập để xem hồ sơ tác giả',
      });
    }

    const application = await this.persistence.findByUserId(query.userId);

    return application
      ? AuthorApplicationResultMapper.toDto(application)
      : null;
  }
}
