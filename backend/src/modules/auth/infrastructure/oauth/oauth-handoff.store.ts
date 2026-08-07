import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type Redis from 'ioredis';

import { ServiceUnavailableException } from '@/common/exceptions';

import { sha256 } from '@/common/utils';

import type { AuthConfig } from '@/config';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import { OAuthFlowInvalidException } from '../../domain/exceptions';

export interface OAuthHandoffMfaChallenge {
  mfaTicket: string;

  mode: 'enroll' | 'verify';

  expiresAt: string;
}

export type OAuthHandoffResult =
  | {
      status: 'success';
    }
  | {
      status: 'mfa';

      challenge: OAuthHandoffMfaChallenge;
    }
  | {
      status: 'error';

      code: string;

      message: string;
    };

@Injectable()
export class OAuthHandoffStore {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async issue(result: OAuthHandoffResult): Promise<string> {
    const handoff = randomBytes(32).toString('base64url');

    await this.requireRedis().set(
      this.key(handoff),

      JSON.stringify(result),

      'EX',

      this.config.oauth.stateTtlSeconds,

      'NX',
    );

    return handoff;
  }

  async consume(handoff: string): Promise<OAuthHandoffResult> {
    const normalized = handoff.trim();

    if (!/^[A-Za-z0-9_-]{32,512}$/u.test(normalized)) {
      throw new OAuthFlowInvalidException();
    }

    const raw = await this.requireRedis().getdel(this.key(normalized));

    /*
     * Handoff chỉ được dùng đúng 1 lần.
     */
    if (!raw) {
      throw new OAuthFlowInvalidException(
        'Phiên hoàn tất OAuth không hợp lệ hoặc đã hết hạn',
      );
    }

    try {
      const result = JSON.parse(raw) as OAuthHandoffResult;

      if (
        result.status !== 'success' &&
        result.status !== 'mfa' &&
        result.status !== 'error'
      ) {
        throw new Error('invalid OAuth handoff');
      }

      return result;
    } catch {
      throw new OAuthFlowInvalidException();
    }
  }

  private key(handoff: string): string {
    return ['auth', 'oauth', 'handoff', sha256(handoff)].join(':');
  }

  private requireRedis(): Redis {
    if (!this.redis) {
      throw new ServiceUnavailableException({
        code: 'AUTH_OAUTH_HANDOFF_STORE_UNAVAILABLE',

        message: 'Dịch vụ OAuth tạm thời không khả dụng',

        service: 'redis',
      });
    }

    return this.redis;
  }
}
