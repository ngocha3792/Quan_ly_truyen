import { Inject, Injectable } from '@nestjs/common';

import type { VerifyEmailResultDto } from '../../dto';
import { VerifyEmailResultMapper } from '../../mappers';
import {
  EMAIL_VERIFICATION_PERSISTENCE_PORT,
  type EmailVerificationPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import {
  EmailVerificationTokenExpiredException,
  InvalidEmailVerificationTokenException,
} from '../../../domain/exceptions';
import { EmailVerificationTokenValueObject } from '../../../domain/value-objects';

import { VerifyEmailCommand } from './verify-email.command';

@Injectable()
export class VerifyEmailCommandHandler {
  constructor(
    @Inject(EMAIL_VERIFICATION_PERSISTENCE_PORT)
    private readonly persistence: EmailVerificationPersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<VerifyEmailResultDto> {
    const token = EmailVerificationTokenValueObject.create(command.token);

    const result = await this.persistence.consume({
      tokenHash: this.secureToken.hash(token.value),
      verifiedAt: new Date(),
    });

    switch (result.status) {
      case 'verified':
        return VerifyEmailResultMapper.toDto(result, false);

      case 'already_verified':
        return VerifyEmailResultMapper.toDto(result, true);

      case 'expired':
        throw new EmailVerificationTokenExpiredException(result.expiresAt);

      case 'invalid':
      default:
        throw new InvalidEmailVerificationTokenException();
    }
  }
}
