import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { RequestEmailChangeResultDto } from '../../dto';

import { RequestEmailChangeResultMapper } from '../../mappers';

import {
  EMAIL_CHANGE_PERSISTENCE_PORT,
  type EmailChangePersistencePort,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';

import {
  EmailAlreadyInUseException,
  EmailChangeUnavailableException,
  InvalidCurrentPasswordException,
  NewEmailMustDifferException,
} from '../../../domain/exceptions';

import { EmailChangePolicy } from '../../../domain/policies';

import {
  CurrentPasswordValueObject,
  EmailValueObject,
} from '../../../domain/value-objects';

import { RequestEmailChangeCommand } from './request-email-change.command';

@Injectable()
export class RequestEmailChangeCommandHandler {
  constructor(
    @Inject(EMAIL_CHANGE_PERSISTENCE_PORT)
    private readonly persistence: EmailChangePersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    command: RequestEmailChangeCommand,
  ): Promise<RequestEmailChangeResultDto> {
    if (!command.userId || !isUuidV4(command.userId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_USER_REQUIRED_FOR_EMAIL_CHANGE',

        message: 'Bạn cần đăng nhập để thay đổi email',
      });
    }

    const currentPassword = CurrentPasswordValueObject.create(
      command.currentPassword,
    );

    const newEmail = EmailValueObject.create(command.newEmail);

    const credential = await this.persistence.findCredentialByUserId(
      command.userId,
    );

    if (!credential) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    if (!credential.passwordHash) {
      throw new EmailChangeUnavailableException();
    }

    if (credential.email.toLowerCase() === newEmail.value) {
      throw new NewEmailMustDifferException();
    }

    const passwordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    const rawToken = this.secureToken.generate();

    const tokenHash = this.secureToken.hash(rawToken);

    const requestedAt = new Date();

    const expiresAt = EmailChangePolicy.createExpiresAt(requestedAt);

    const result = await this.persistence.request({
      userId: command.userId,

      expectedCurrentEmail: credential.email,

      expectedPasswordHash: credential.passwordHash,

      newEmail: newEmail.value,

      rawToken,

      tokenHash,

      requestedAt,

      expiresAt,

      expiresInMinutes: EmailChangePolicy.TTL_MINUTES,
    });

    switch (result.status) {
      case 'requested':
        return RequestEmailChangeResultMapper.toDto(
          result.newEmail,

          result.expiresAt,
        );

      case 'email_in_use':
        throw new EmailAlreadyInUseException(result.email);

      case 'same_email':
        throw new NewEmailMustDifferException();

      case 'account_unavailable':
        throw new AuthenticationRequiredException({
          code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

          message: 'Tài khoản hiện tại không còn khả dụng',
        });

      case 'conflict':
      default:
        /*
         * Password/email hiện tại đã thay đổi
         * giữa lúc handler đọc account và lúc
         * transaction bắt đầu.
         */
        throw new InvalidCurrentPasswordException();
    }
  }
}
