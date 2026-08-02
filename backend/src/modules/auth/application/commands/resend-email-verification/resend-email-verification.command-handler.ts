import { Inject, Injectable } from '@nestjs/common';

import type { ResendEmailVerificationResultDto } from '../../dto';
import { ResendEmailVerificationResultMapper } from '../../mappers';
import {
  EMAIL_VERIFICATION_COOLDOWN_PORT,
  type EmailVerificationCooldownPort,
  RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT,
  type ResendEmailVerificationPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import { EmailVerificationPolicy } from '../../../domain/policies';
import { EmailValueObject } from '../../../domain/value-objects';

import { ResendEmailVerificationCommand } from './resend-email-verification.command';

@Injectable()
export class ResendEmailVerificationCommandHandler {
  constructor(
    @Inject(EMAIL_VERIFICATION_COOLDOWN_PORT)
    private readonly cooldown: EmailVerificationCooldownPort,

    @Inject(RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT)
    private readonly persistence: ResendEmailVerificationPersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    command: ResendEmailVerificationCommand,
  ): Promise<ResendEmailVerificationResultDto> {
    const email = EmailValueObject.create(command.email);

    const acquired = await this.cooldown.tryAcquire(email.value);

    /*
     * Không trả 429 riêng cho email đang cooldown.
     * Response giống hoàn toàn trường hợp email không tồn tại.
     */
    if (!acquired) {
      return ResendEmailVerificationResultMapper.accepted();
    }

    const rawToken = this.secureToken.generate();

    const tokenHash = this.secureToken.hash(rawToken);

    try {
      await this.persistence.execute({
        email: email.value,

        rawToken,
        tokenHash,

        expiresAt: EmailVerificationPolicy.createExpiresAt(),

        expiresInMinutes: EmailVerificationPolicy.TTL_MINUTES,
      });
    } catch (error: unknown) {
      /*
       * Nếu database hoặc outbox lỗi, cho phép thử lại ngay.
       *
       * Không để lỗi release che mất lỗi gốc.
       */
      try {
        await this.cooldown.release(email.value);
      } catch {
        // Không ghi email/raw token vào log.
      }

      throw error;
    }

    return ResendEmailVerificationResultMapper.accepted();
  }
}
