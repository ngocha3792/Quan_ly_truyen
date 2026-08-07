import { Inject, Injectable } from '@nestjs/common';

import type { ValidatePasswordResetTokenResultDto } from '../../dto';

import {
  PASSWORD_RESET_PERSISTENCE_PORT,
  type PasswordResetPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';

import {
  InvalidPasswordResetTokenException,
  PasswordResetTokenExpiredException,
} from '../../../domain/exceptions';

import { PasswordResetTokenValueObject } from '../../../domain/value-objects';

import { ValidatePasswordResetTokenQuery } from './validate-password-reset-token.query';

@Injectable()
export class ValidatePasswordResetTokenQueryHandler {
  constructor(
    @Inject(PASSWORD_RESET_PERSISTENCE_PORT)
    private readonly persistence: PasswordResetPersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    query: ValidatePasswordResetTokenQuery,
  ): Promise<ValidatePasswordResetTokenResultDto> {
    /*
     * Validate format trước khi hash/query DB.
     */
    const token = PasswordResetTokenValueObject.create(query.token);

    const result = await this.persistence.validate({
      tokenHash: this.secureToken.hash(token.value),

      now: new Date(),
    });

    switch (result.status) {
      case 'valid':
        return {
          valid: true,

          expiresAt: result.expiresAt,
        };

      case 'expired':
        throw new PasswordResetTokenExpiredException(result.expiresAt);

      case 'invalid':
      default:
        throw new InvalidPasswordResetTokenException();
    }
  }
}
