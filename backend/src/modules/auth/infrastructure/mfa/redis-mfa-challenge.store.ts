import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type Redis from 'ioredis';

import { ServiceUnavailableException } from '@/common/exceptions';

import { sha256 } from '@/common/utils';

import type { AuthConfig } from '@/config';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import type {
  CreateMfaChallengeInput,
  MfaChallengePort,
  MfaChallengeResult,
} from '../../application/ports';

import { InvalidMfaTicketException } from '../../domain/exceptions';

export interface StoredMfaChallenge extends CreateMfaChallengeInput {
  attemptsRemaining: number;

  expiresAt: string;

  /*
   * Chỉ tồn tại với flow admin bắt buộc
   * enrollment trước khi login.
   */
  pendingSecret?: string;
}

@Injectable()
export class RedisMfaChallengeStore implements MfaChallengePort {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  isAdminMfaRequired(): boolean {
    /*
     * Giữ nguyên env hiện tại:
     *
     * AUTH_ADMIN_MFA_ENABLED=true
     *
     * nhưng ý nghĩa mới là:
     * ADMIN bắt buộc MFA.
     *
     * User thường vẫn có thể bật MFA
     * dù giá trị này là false.
     */
    return this.config.adminMfa.enabled;
  }

  async create(input: CreateMfaChallengeInput): Promise<MfaChallengeResult> {
    const redis = this.requireRedis();

    const ticket = randomBytes(32).toString('base64url');

    const expiresAt = new Date(
      Date.now() + this.config.adminMfa.preAuthTicketTtlSeconds * 1000,
    );

    const stored: StoredMfaChallenge = {
      ...input,

      attemptsRemaining: this.config.adminMfa.maxVerificationAttempts,

      expiresAt: expiresAt.toISOString(),
    };

    await redis.set(
      this.key(ticket),

      JSON.stringify(stored),

      'EX',

      this.config.adminMfa.preAuthTicketTtlSeconds,

      'NX',
    );

    return {
      ticket,

      mode: input.mode,

      expiresAt,
    };
  }

  async read(ticket: string): Promise<StoredMfaChallenge> {
    const raw = await this.requireRedis().get(this.key(ticket));

    if (!raw) {
      throw new InvalidMfaTicketException();
    }

    return parseChallenge(raw);
  }

  async savePendingSecret(
    ticket: string,

    encryptedSecret: string,
  ): Promise<string> {
    const result = await this.requireRedis().eval(
      `
          local raw =
            redis.call(
              'GET',
              KEYS[1]
            )

          if not raw then
            return nil
          end

          local value =
            cjson.decode(raw)

          if value.mode ~= 'enroll' then
            return nil
          end

          if value.pendingSecret then
            return value.pendingSecret
          end

          value.pendingSecret =
            ARGV[1]

          redis.call(
            'SET',
            KEYS[1],
            cjson.encode(value),
            'KEEPTTL'
          )

          return ARGV[1]
          `,

      1,

      this.key(ticket),

      encryptedSecret,
    );

    if (typeof result !== 'string') {
      throw new InvalidMfaTicketException();
    }

    return result;
  }

  async consume(ticket: string): Promise<StoredMfaChallenge> {
    const raw = await this.requireRedis().getdel(this.key(ticket));

    if (!raw) {
      throw new InvalidMfaTicketException();
    }

    return parseChallenge(raw);
  }

  async recordFailure(ticket: string): Promise<number> {
    const result = await this.requireRedis().eval(
      `
          local raw =
            redis.call(
              'GET',
              KEYS[1]
            )

          if not raw then
            return nil
          end

          local value =
            cjson.decode(raw)

          value.attemptsRemaining =
            tonumber(
              value.attemptsRemaining
            ) - 1

          if value.attemptsRemaining <= 0 then
            redis.call(
              'DEL',
              KEYS[1]
            )

            return 0
          end

          redis.call(
            'SET',
            KEYS[1],
            cjson.encode(value),
            'KEEPTTL'
          )

          return value.attemptsRemaining
          `,

      1,

      this.key(ticket),
    );

    if (result === null || result === undefined) {
      throw new InvalidMfaTicketException();
    }

    return Number(result);
  }

  private key(ticket: string): string {
    return ['auth', 'mfa', 'preauth', sha256(ticket)].join(':');
  }

  private requireRedis(): Redis {
    if (!this.redis) {
      throw new ServiceUnavailableException({
        code: 'AUTH_MFA_STORE_UNAVAILABLE',

        message: 'Dịch vụ xác minh MFA tạm thời không khả dụng',

        service: 'redis',
      });
    }

    return this.redis;
  }
}

function parseChallenge(raw: string): StoredMfaChallenge {
  try {
    const value = JSON.parse(raw) as StoredMfaChallenge;

    if (!value.userId || !value.mode || !value.source || !value.expiresAt) {
      throw new Error('invalid');
    }

    return value;
  } catch {
    throw new InvalidMfaTicketException();
  }
}
