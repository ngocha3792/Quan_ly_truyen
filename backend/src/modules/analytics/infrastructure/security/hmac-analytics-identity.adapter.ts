import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AnalyticsIdentityPort } from '../../application/ports';
import { ConfigService } from '@nestjs/config';
import type { AnalyticsConfig } from '@/config';

@Injectable()
export class HmacAnalyticsIdentityAdapter implements AnalyticsIdentityPort {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret =
      config.getOrThrow<AnalyticsConfig>('analytics').identityHmacSecret;
  }

  hashAuthenticated(userId: string): string {
    return this.hash(`user:${userId}`);
  }

  hashAnonymous(anonymousReaderId: string): string {
    return this.hash(`anon:${anonymousReaderId}`);
  }

  private hash(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }
}
