import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { ServiceUnavailableException } from '@/common/exceptions';
import { sha256 } from '@/common/utils';
import type { AuthConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import type { EmailVerificationCooldownPort } from '../../application/ports';

@Injectable()
export class RedisEmailVerificationCooldown implements EmailVerificationCooldownPort {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async tryAcquire(email: string): Promise<boolean> {
    const client = this.requireRedis();

    try {
      const result = await client.set(
        this.createKey(email),
        String(Date.now()),
        'EX',
        this.config.emailVerification.resendCooldownSeconds,
        'NX',
      );

      return result === 'OK';
    } catch (error: unknown) {
      throw this.createUnavailableException(error);
    }
  }

  async release(email: string): Promise<void> {
    const client = this.requireRedis();

    try {
      await client.del(this.createKey(email));
    } catch (error: unknown) {
      throw this.createUnavailableException(error);
    }
  }

  private createKey(email: string): string {
    const normalized = email.trim().toLowerCase();

    return [
      'auth',
      'email-verification',
      'resend-cooldown',
      sha256(normalized),
    ].join(':');
  }

  private requireRedis(): Redis {
    if (!this.redisClient) {
      throw this.createUnavailableException();
    }

    return this.redisClient;
  }

  private createUnavailableException(
    cause?: unknown,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AUTH_EMAIL_VERIFICATION_COOLDOWN_UNAVAILABLE',

      message: 'Dịch vụ gửi lại email xác minh tạm thời không khả dụng',

      service: 'redis',

      cause,
    });
  }
}
