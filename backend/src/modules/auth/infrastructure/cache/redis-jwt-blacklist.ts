import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { ServiceUnavailableException } from '@/common/exceptions';
import { sha256 } from '@/common/utils';
import type { AuthConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import type {
  BlacklistAccessTokenInput,
  JwtBlacklistPort,
} from '../../application/ports';

@Injectable()
export class RedisJwtBlacklist implements JwtBlacklistPort {
  private readonly logger = new Logger(RedisJwtBlacklist.name);

  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async isBlacklisted(tokenId: string): Promise<boolean> {
    if (!this.config.jwtBlacklist.enabled) {
      return false;
    }

    try {
      const client = this.requireRedisClient();

      const value = await client.get(this.createKey(tokenId));

      return value !== null;
    } catch (error: unknown) {
      return this.handleReadFailure(error);
    }
  }

  async blacklist(input: BlacklistAccessTokenInput): Promise<void> {
    if (!this.config.jwtBlacklist.enabled) {
      return;
    }

    const ttlSeconds = Math.ceil(
      (input.expiresAt.getTime() - Date.now()) / 1000,
    );

    /*
     * Token đã hết hạn thì không cần blacklist.
     */
    if (ttlSeconds <= 0) {
      return;
    }

    try {
      const client = this.requireRedisClient();

      await client.set(
        this.createKey(input.tokenId),

        JSON.stringify({
          reason: input.reason,
          blacklistedAt: new Date().toISOString(),
        }),

        'EX',
        ttlSeconds,
      );
    } catch (error: unknown) {
      this.handleWriteFailure(error);
    }
  }

  private createKey(tokenId: string): string {
    return ['auth', 'jwt', 'blacklist', sha256(tokenId)].join(':');
  }

  private requireRedisClient(): Redis {
    if (!this.redisClient) {
      throw this.createUnavailableException();
    }

    return this.redisClient;
  }

  private handleReadFailure(error: unknown): boolean {
    if (this.config.jwtBlacklist.failureMode === 'open') {
      this.logger.warn(
        'JWT blacklist read failed; continuing because failure mode is open',
      );

      return false;
    }

    throw this.createUnavailableException(error);
  }

  private handleWriteFailure(error: unknown): void {
    if (this.config.jwtBlacklist.failureMode === 'open') {
      this.logger.warn(
        'JWT blacklist write failed; continuing because failure mode is open',
      );

      return;
    }

    throw this.createUnavailableException(error);
  }

  private createUnavailableException(
    cause?: unknown,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',

      message: 'Dịch vụ kiểm tra token tạm thời không khả dụng',

      service: 'redis',

      cause,
    });
  }
}
