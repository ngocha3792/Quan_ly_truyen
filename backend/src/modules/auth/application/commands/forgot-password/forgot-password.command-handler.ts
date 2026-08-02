import { Inject, Injectable } from '@nestjs/common';

import type { ForgotPasswordResultDto } from '../../dto';
import { ForgotPasswordResultMapper } from '../../mappers';
import {
  PASSWORD_RESET_COOLDOWN_PORT,
  type PasswordResetCooldownPort,
  PASSWORD_RESET_PERSISTENCE_PORT,
  type PasswordResetPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import { PasswordResetPolicy } from '../../../domain/policies';
import { EmailValueObject } from '../../../domain/value-objects';

import { ForgotPasswordCommand } from './forgot-password.command';

@Injectable()
export class ForgotPasswordCommandHandler {
  constructor(
    @Inject(PASSWORD_RESET_COOLDOWN_PORT)
    private readonly cooldown: PasswordResetCooldownPort,

    @Inject(PASSWORD_RESET_PERSISTENCE_PORT)
    private readonly persistence: PasswordResetPersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    command: ForgotPasswordCommand,
  ): Promise<ForgotPasswordResultDto> {
    const email = EmailValueObject.create(command.email);

    const acquired = await this.cooldown.tryAcquire(email.value);

    /*
     * Không tiết lộ email đang cooldown,
     * không tồn tại hoặc đã nhận mail.
     */
    if (!acquired) {
      return ForgotPasswordResultMapper.accepted();
    }

    const rawToken = this.secureToken.generate();

    const tokenHash = this.secureToken.hash(rawToken);

    try {
      await this.persistence.request({
        email: email.value,

        rawToken,
        tokenHash,

        expiresAt: PasswordResetPolicy.createExpiresAt(),

        expiresInMinutes: PasswordResetPolicy.TTL_MINUTES,
      });
    } catch (error: unknown) {
      /*
       * DB/outbox lỗi thì gỡ cooldown
       * để người dùng có thể thử lại.
       */
      try {
        await this.cooldown.release(email.value);
      } catch {
        // Không để lỗi Redis che mất lỗi gốc.
      }

      throw error;
    }

    return ForgotPasswordResultMapper.accepted();
  }
}
