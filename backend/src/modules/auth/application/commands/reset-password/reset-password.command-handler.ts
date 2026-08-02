import { Inject, Injectable } from '@nestjs/common';

import type { ResetPasswordResultDto } from '../../dto';
import { ResetPasswordResultMapper } from '../../mappers';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  PASSWORD_RESET_PERSISTENCE_PORT,
  type PasswordResetPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import {
  InvalidPasswordResetTokenException,
  PasswordResetTokenExpiredException,
} from '../../../domain/exceptions';
import {
  PasswordResetTokenValueObject,
  PasswordValueObject,
} from '../../../domain/value-objects';

import { ResetPasswordCommand } from './reset-password.command';

@Injectable()
export class ResetPasswordCommandHandler {
  constructor(
    @Inject(PASSWORD_RESET_PERSISTENCE_PORT)
    private readonly persistence: PasswordResetPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    command: ResetPasswordCommand,
  ): Promise<ResetPasswordResultDto> {
    const token = PasswordResetTokenValueObject.create(command.token);

    const newPassword = PasswordValueObject.create(command.newPassword);

    const passwordHash = await this.passwordHasher.hash(newPassword.value);

    const result = await this.persistence.reset({
      tokenHash: this.secureToken.hash(token.value),

      passwordHash,

      resetAt: new Date(),
    });

    switch (result.status) {
      case 'reset':
        return ResetPasswordResultMapper.toDto(result);

      case 'expired':
        throw new PasswordResetTokenExpiredException(result.expiresAt);

      case 'invalid':
      default:
        throw new InvalidPasswordResetTokenException();
    }
  }
}
