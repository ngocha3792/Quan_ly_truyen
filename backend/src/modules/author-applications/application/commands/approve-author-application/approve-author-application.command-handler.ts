import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import { AccessAuthorizationCacheService } from '@/modules/auth';

import {
  AuthorAlreadyActiveException,
  AuthorApplicationNotFoundException,
  AuthorApplicationNotPendingException,
  AuthorApplicationSelfReviewException,
  AuthorPenNameUnavailableException,
  AuthorRoleUnavailableException,
} from '../../../domain';

import type { AuthorApplicationResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { ApproveAuthorApplicationCommand } from './approve-author-application.command';

@Injectable()
export class ApproveAuthorApplicationCommandHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,

    private readonly authorizationCache: AccessAuthorizationCacheService,
  ) {}

  async execute(
    command: ApproveAuthorApplicationCommand,
  ): Promise<AuthorApplicationResultDto> {
    if (!command.reviewerId || !isUuidV4(command.reviewerId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTHOR_APPLICATION_REVIEWER_REQUIRED',

        message: 'Không xác định được người xét duyệt',
      });
    }

    const result = await this.persistence.approve({
      applicationId: command.applicationId,

      reviewerId: command.reviewerId,

      reviewedAt: new Date(),

      audit: {
        ipAddress: command.ipAddress,

        userAgent: command.userAgent,

        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'approved':
        /*
         * Auth module đã ghi rõ:
         *
         * thay đổi role / author profile
         * bắt buộc invalidate authorization cache.
         */
        await this.authorizationCache.invalidateUser(result.userId);

        return AuthorApplicationResultMapper.toDto(result.application);

      case 'not_found':
        throw new AuthorApplicationNotFoundException(command.applicationId);

      case 'not_pending':
        throw new AuthorApplicationNotPendingException();

      case 'self_review':
        throw new AuthorApplicationSelfReviewException();

      case 'pen_name_unavailable':
        throw new AuthorPenNameUnavailableException(result.penName);

      case 'role_missing':
        throw new AuthorRoleUnavailableException();

      case 'already_author':
      default:
        throw new AuthorAlreadyActiveException();
    }
  }
}
