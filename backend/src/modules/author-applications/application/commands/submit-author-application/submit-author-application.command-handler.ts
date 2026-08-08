import { Inject, Injectable } from '@nestjs/common';

import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import {
  AuthorAlreadyActiveException,
  AuthorApplicationIncompleteException,
  AuthorApplicationNotFoundException,
  AuthorPenNameUnavailableException,
  InvalidAuthorApplicationSampleException,
} from '../../../domain';

import type { AuthorApplicationResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { SubmitAuthorApplicationCommand } from './submit-author-application.command';

@Injectable()
export class SubmitAuthorApplicationCommandHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,
  ) {}

  async execute(
    command: SubmitAuthorApplicationCommand,
  ): Promise<AuthorApplicationResultDto> {
    if (!command.userId || !isUuidV4(command.userId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTHOR_APPLICATION_AUTHENTICATION_REQUIRED',

        message: 'Bạn cần đăng nhập để gửi hồ sơ',
      });
    }

    if (!isUuidV4(command.applicationId) || !isUuidV4(command.sampleMediaId)) {
      throw new InvalidInputException({
        code: 'AUTHOR_APPLICATION_INVALID_ID',

        message: 'Thông tin hồ sơ hoặc file mẫu không hợp lệ',
      });
    }

    const result = await this.persistence.submit({
      userId: command.userId,

      applicationId: command.applicationId,

      sampleMediaId: command.sampleMediaId,

      submittedAt: new Date(),

      audit: {
        ipAddress: command.ipAddress,

        userAgent: command.userAgent,

        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'submitted':
        return AuthorApplicationResultMapper.toDto(result.application);

      case 'not_found':
        throw new AuthorApplicationNotFoundException(command.applicationId);

      case 'already_author':
        throw new AuthorAlreadyActiveException();

      case 'incomplete':
        throw new AuthorApplicationIncompleteException(result.missingFields);

      case 'invalid_sample':
        throw new InvalidAuthorApplicationSampleException();

      case 'pen_name_unavailable':
      default:
        throw new AuthorPenNameUnavailableException(result.penName);
    }
  }
}
