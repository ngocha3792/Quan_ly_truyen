import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import {
  RateLimitExceededException,
  ServiceUnavailableException,
} from '@/common/exceptions';
import { sha256 } from '@/common/utils';
import type { AuthConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import type {
  LoginRateLimitInput,
  LoginRateLimiterPort,
} from '../../application/ports';

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local count = redis.call('INCR', KEYS[1])

if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end

local ttl = redis.call('TTL', KEYS[1])

return { count, ttl }
`;

interface RateLimitSubject {
  key: string;
  limit: number;
  scope: 'ip' | 'identifier';
}

interface CounterSnapshot extends RateLimitSubject {
  count: number;
  ttlSeconds: number;
}

@Injectable()
export class RedisLoginRateLimiter implements LoginRateLimiterPort {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async assertAllowed(input: LoginRateLimitInput): Promise<void> {
    if (!this.config.loginRateLimit.enabled) {
      return;
    }

    const subjects = this.buildSubjects(input);

    const snapshots = await Promise.all(
      subjects.map((subject) => this.readCounter(subject)),
    );

    this.throwWhenBlocked(snapshots);
  }

  async recordFailure(input: LoginRateLimitInput): Promise<void> {
    if (!this.config.loginRateLimit.enabled) {
      return;
    }

    const subjects = this.buildSubjects(input);

    /*
     * Increment tất cả scope trước khi ném lỗi.
     * Nhờ đó IP và identifier đều được ghi nhận.
     */
    const snapshots = await Promise.all(
      subjects.map((subject) => this.incrementCounter(subject)),
    );

    this.throwWhenBlocked(snapshots);
  }

  async resetAfterSuccess(input: LoginRateLimitInput): Promise<void> {
    if (!this.config.loginRateLimit.enabled) {
      return;
    }

    const client = this.getRedisClient();

    const key = this.createIdentifierKey(input.identifier);

    try {
      await client.del(key);
    } catch (error: unknown) {
      throw this.createRedisUnavailableException(
        'reset-login-rate-limit',
        error,
      );
    }
  }

  private buildSubjects(input: LoginRateLimitInput): RateLimitSubject[] {
    const subjects: RateLimitSubject[] = [
      {
        key: this.createIdentifierKey(input.identifier),

        limit: this.config.loginRateLimit.identifierLimit,

        scope: 'identifier',
      },
    ];

    const ipAddress = input.ipAddress?.trim();

    if (ipAddress) {
      subjects.push({
        key: this.createIpKey(ipAddress),

        limit: this.config.loginRateLimit.ipLimit,

        scope: 'ip',
      });
    }

    return subjects;
  }

  private async readCounter(
    subject: RateLimitSubject,
  ): Promise<CounterSnapshot> {
    const client = this.getRedisClient();

    try {
      const [rawCount, rawTtl] = await Promise.all([
        client.get(subject.key),
        client.ttl(subject.key),
      ]);

      const count = Number(rawCount ?? 0);

      const ttlSeconds =
        rawTtl > 0 ? rawTtl : this.config.loginRateLimit.windowSeconds;

      return {
        ...subject,
        count: Number.isFinite(count) && count > 0 ? count : 0,
        ttlSeconds,
      };
    } catch (error: unknown) {
      throw this.createRedisUnavailableException(
        'read-login-rate-limit',
        error,
      );
    }
  }

  private async incrementCounter(
    subject: RateLimitSubject,
  ): Promise<CounterSnapshot> {
    const client = this.getRedisClient();

    try {
      const result = (await client.eval(
        INCREMENT_WITH_EXPIRY_SCRIPT,
        1,
        subject.key,
        String(this.config.loginRateLimit.windowSeconds),
      )) as [number | string, number | string];

      const count = Number(result[0]);
      const rawTtl = Number(result[1]);

      return {
        ...subject,

        count: Number.isFinite(count) && count > 0 ? count : 1,

        ttlSeconds:
          Number.isFinite(rawTtl) && rawTtl > 0
            ? rawTtl
            : this.config.loginRateLimit.windowSeconds,
      };
    } catch (error: unknown) {
      throw this.createRedisUnavailableException(
        'increment-login-rate-limit',
        error,
      );
    }
  }

  private throwWhenBlocked(snapshots: readonly CounterSnapshot[]): void {
    const blocked = snapshots
      .filter((snapshot) => snapshot.count >= snapshot.limit)
      .sort((left, right) => right.ttlSeconds - left.ttlSeconds)[0];

    if (!blocked) {
      return;
    }

    throw new RateLimitExceededException({
      code: 'AUTH_LOGIN_RATE_LIMIT_EXCEEDED',

      message: 'Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau',

      retryAfterSeconds: Math.max(1, blocked.ttlSeconds),

      limit: blocked.limit,

      details: {
        scope: blocked.scope,
      },
    });
  }

  private createIdentifierKey(identifier: string): string {
    const normalized = identifier.trim().toLowerCase();

    return ['auth', 'login', 'failures', 'identifier', sha256(normalized)].join(
      ':',
    );
  }

  private createIpKey(ipAddress: string): string {
    return ['auth', 'login', 'failures', 'ip', sha256(ipAddress)].join(':');
  }

  private getRedisClient(): Redis {
    if (!this.redisClient) {
      throw this.createRedisUnavailableException('access-login-rate-limit');
    }

    return this.redisClient;
  }

  private createRedisUnavailableException(
    operation: string,
    cause?: unknown,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AUTH_LOGIN_RATE_LIMIT_UNAVAILABLE',

      message: 'Dịch vụ bảo vệ đăng nhập tạm thời không khả dụng',

      service: 'redis',

      details: {
        operation,
      },

      cause,
    });
  }
}
