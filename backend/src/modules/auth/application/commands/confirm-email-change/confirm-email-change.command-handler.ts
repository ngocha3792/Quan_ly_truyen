import { Inject, Injectable } from '@nestjs/common';

import type { ConfirmEmailChangeResultDto } from '../../dto';

import { ConfirmEmailChangeResultMapper } from '../../mappers';

import {
  EMAIL_CHANGE_PERSISTENCE_PORT,
  type EmailChangePersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';

import {
  EmailAlreadyInUseException,
  EmailChangeTokenExpiredException,
  InvalidEmailChangeTokenException,
} from '../../../domain/exceptions';

import { EmailChangeTokenValueObject } from '../../../domain/value-objects';

import { ConfirmEmailChangeCommand } from './confirm-email-change.command';

@Injectable()
export class ConfirmEmailChangeCommandHandler {
  constructor(
    @Inject(EMAIL_CHANGE_PERSISTENCE_PORT)
    private readonly persistence: EmailChangePersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    command: ConfirmEmailChangeCommand,
  ): Promise<ConfirmEmailChangeResultDto> {
    const token = EmailChangeTokenValueObject.create(command.token);

    const result = await this.persistence.confirm({
      tokenHash: this.secureToken.hash(token.value),

      confirmedAt: new Date(),
    });

    switch (result.status) {
      case 'changed':
        return ConfirmEmailChangeResultMapper.toDto(
          result,

          false,
        );

      case 'already_changed':
        return ConfirmEmailChangeResultMapper.toDto(
          result,

          true,
        );

      case 'email_in_use':
        throw new EmailAlreadyInUseException(result.email);

      case 'expired':
        throw new EmailChangeTokenExpiredException(result.expiresAt);

      case 'invalid':
      default:
        throw new InvalidEmailChangeTokenException();
    }
  }
}
