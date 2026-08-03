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

const BLACKLIST_KEY_NAMESPACE = ['auth', 'jwt', 'blacklist'] as const;

const BLACKLIST_VALUE_VERSION = 1;

interface StoredBlacklistEntryV1 {
  version: typeof BLACKLIST_VALUE_VERSION;

  reason: string;

  blacklistedAt: string;

  expiresAt: string;
}

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
    /*
     * Ngoài production có thể disable blacklist
     * để phát triển local không cần Redis.
     *
     * Production sẽ bị environment validation
     * chặn nếu blacklist bị disable.
     */
    if (!this.config.jwtBlacklist.enabled) {
      return false;
    }

    try {
      const client = this.requireRedisClient();

      /*
       * Chỉ cần EXISTS, không cần đọc JSON value.
       */
      const exists = await client.exists(this.createKey(tokenId));

      return exists === 1;
    } catch (error: unknown) {
      return this.handleReadFailure(error);
    }
  }

  async blacklist(input: BlacklistAccessTokenInput): Promise<void> {
    /*
     * Không được silently return tại đây.
     *
     * Nếu endpoint revoke trả 204 trong khi
     * blacklist đang disable thì client sẽ hiểu
     * nhầm rằng token đã bị thu hồi.
     */
    if (!this.config.jwtBlacklist.enabled) {
      throw this.createDisabledException();
    }

    const now = Date.now();

    const ttlSeconds = Math.ceil((input.expiresAt.getTime() - now) / 1000);

    /*
     * Access token đã hết hạn thì không cần
     * tạo Redis entry nữa.
     */
    if (ttlSeconds <= 0) {
      return;
    }

    const entry: StoredBlacklistEntryV1 = {
      version: BLACKLIST_VALUE_VERSION,

      reason: input.reason,

      blacklistedAt: new Date(now).toISOString(),

      expiresAt: input.expiresAt.toISOString(),
    };

    try {
      const client = this.requireRedisClient();

      const result = await client.set(
        this.createKey(input.tokenId),

        JSON.stringify(entry),

        'EX',

        ttlSeconds,
      );

      /*
       * Redis SET bình thường phải trả "OK".
       * Không được coi null/undefined là thành công.
       */
      if (result !== 'OK') {
        throw new Error('Redis SET did not return OK');
      }
    } catch (error: unknown) {
      /*
       * Blacklist write luôn fail-closed.
       *
       * AUTH_JWT_BLACKLIST_FAILURE_MODE=open
       * chỉ được áp dụng cho thao tác đọc.
       *
       * Nếu ghi thất bại, endpoint revoke phải
       * trả lỗi thay vì trả 204 giả.
       */
      this.logger.error(
        'JWT blacklist write failed; access token revoke was aborted',
      );

      throw this.createUnavailableException(error);
    }
  }

  private createKey(tokenId: string): string {
    /*
     * Không đưa JTI plaintext vào Redis key.
     *
     * RedisModule đã tự thêm REDIS_KEY_PREFIX.
     */
    return [...BLACKLIST_KEY_NAMESPACE, sha256(tokenId)].join(':');
  }

  private requireRedisClient(): Redis {
    if (!this.redisClient) {
      throw this.createUnavailableException();
    }

    return this.redisClient;
  }

  private handleReadFailure(error: unknown): boolean {
    if (this.config.jwtBlacklist.failureMode === 'open') {
      /*
       * Chỉ nên dùng open ở local/test.
       *
       * Không log tokenId, Redis key hoặc
       * raw Redis error.
       */
      this.logger.warn(
        'JWT blacklist read failed; continuing because failure mode is open',
      );

      return false;
    }

    throw this.createUnavailableException(error);
  }

  private createDisabledException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AUTH_JWT_BLACKLIST_DISABLED',

      message: 'Chức năng thu hồi access token hiện không khả dụng',

      service: 'jwt-blacklist',
    });
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
