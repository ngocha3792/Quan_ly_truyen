import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import {
  AuthorApplicationNotFoundException,
  AuthorApplicationNotPendingException,
  AuthorApplicationSelfReviewException,
  AuthorRejectionReasonValueObject,
} from '../../../domain';

import type { AuthorApplicationResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { RejectAuthorApplicationCommand } from './reject-author-application.command';

@Injectable()
export class RejectAuthorApplicationCommandHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,
  ) {}

  async execute(
    command: RejectAuthorApplicationCommand,
  ): Promise<AuthorApplicationResultDto> {
    if (!command.reviewerId || !isUuidV4(command.reviewerId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTHOR_APPLICATION_REVIEWER_REQUIRED',

        message: 'Không xác định được người xét duyệt',
      });
    }

    const reason = AuthorRejectionReasonValueObject.create(command.reason);

    const result = await this.persistence.reject({
      applicationId: command.applicationId,

      reviewerId: command.reviewerId,

      reason: reason.value,

      reviewedAt: new Date(),

      audit: {
        ipAddress: command.ipAddress,

        userAgent: command.userAgent,

        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'rejected':
        return AuthorApplicationResultMapper.toDto(result.application);

      case 'not_found':
        throw new AuthorApplicationNotFoundException(command.applicationId);

      case 'self_review':
        throw new AuthorApplicationSelfReviewException();

      case 'not_pending':
      default:
        throw new AuthorApplicationNotPendingException();
    }
  }
}
