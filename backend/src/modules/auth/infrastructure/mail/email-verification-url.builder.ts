import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ConfigurationException } from '@/common/exceptions';
import type { MailConfig } from '@/config';

@Injectable()
export class EmailVerificationUrlBuilder {
  private readonly mailConfig: MailConfig;

  constructor(configService: ConfigService) {
    this.mailConfig = configService.getOrThrow<MailConfig>('mail');
  }

  build(rawToken: string): string {
    try {
      const url = new URL('/verify-email', this.mailConfig.frontendPublicUrl);

      url.searchParams.set('token', rawToken);

      return url.toString();
    } catch (error: unknown) {
      throw new ConfigurationException({
        code: 'AUTH_INVALID_FRONTEND_PUBLIC_URL',

        message: 'FRONTEND_PUBLIC_URL không hợp lệ cho luồng xác minh email',

        key: 'FRONTEND_PUBLIC_URL',

        cause: error,
      });
    }
  }
}
