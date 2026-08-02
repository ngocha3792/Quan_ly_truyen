import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { ServiceUnavailableException } from '@/common/exceptions';
import { sha256 } from '@/common/utils';
import type { AuthConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import type { PasswordResetCooldownPort } from '../../application/ports';

@Injectable()
export class RedisPasswordResetCooldown implements PasswordResetCooldownPort {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async tryAcquire(email: string): Promise<boolean> {
    const client = this.requireRedisClient();

    try {
      const result = await client.set(
        this.createKey(email),

        String(Date.now()),

        'EX',

        this.config.passwordReset.requestCooldownSeconds,

        'NX',
      );

      return result === 'OK';
    } catch (error: unknown) {
      throw this.createUnavailableException(error);
    }
  }

  async release(email: string): Promise<void> {
    const client = this.requireRedisClient();

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
      'password-reset',
      'request-cooldown',
      sha256(normalized),
    ].join(':');
  }

  private requireRedisClient(): Redis {
    if (!this.redisClient) {
      throw this.createUnavailableException();
    }

    return this.redisClient;
  }

  private createUnavailableException(
    cause?: unknown,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AUTH_PASSWORD_RESET_COOLDOWN_UNAVAILABLE',

      message: 'Dịch vụ đặt lại mật khẩu tạm thời không khả dụng',

      service: 'redis',

      cause,
    });
  }
}
