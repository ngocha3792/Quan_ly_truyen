import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  AUTHORIZATION_INVALIDATION_PORT,
  type AuthorizationInvalidationPort,
} from '@/common/interfaces/auth';

import { isUuidV4 } from '@/common/utils';

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
  private readonly logger = new Logger(
    ApproveAuthorApplicationCommandHandler.name,
  );

  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,

    @Inject(AUTHORIZATION_INVALIDATION_PORT)
    private readonly authorizationInvalidation: AuthorizationInvalidationPort,
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
         * Persistence transaction đã commit tại đây.
         *
         * Cache invalidation là side effect hậu commit.
         *
         * Nếu invalidation fail:
         * - DB vẫn là source of truth.
         * - cache sẽ hết TTL.
         * - client KHÔNG được nhận false failure
         *   rồi retry approve.
         *
         * Đây là role GRANT nên stale cache chủ yếu
         * gây false-deny tạm thời, không cấp thêm
         * quyền ngoài ý muốn.
         */
        try {
          await this.authorizationInvalidation.invalidateUser(result.userId);
        } catch (error: unknown) {
          this.logger.warn(
            `Authorization cache invalidation failed after author approval for user ${result.userId}`,

            error instanceof Error ? error.stack : undefined,
          );
        }

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
        throw new AuthorAlreadyActiveException();

      default:
        throw new AuthorAlreadyActiveException();
    }
  }
}
