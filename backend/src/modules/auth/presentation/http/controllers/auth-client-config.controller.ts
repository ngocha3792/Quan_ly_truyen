import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CSRF_HEADER_NAME } from '@/common/constants';
import { Public } from '@/common/decorators';
import type { AuthConfig } from '@/config';

import { PasswordPolicy, PasswordResetPolicy } from '../../../domain';

export interface AuthClientConfigResponse {
  readonly passwordPolicy: {
    readonly minimumLength: number;
    readonly maximumLength: number;
    readonly maximumBytes: number;
    readonly requireLowercase: boolean;
    readonly requireUppercase: boolean;
    readonly requireNumber: boolean;
    readonly requireSymbol: boolean;
  };
  readonly passwordReset: {
    readonly tokenExpiresInMinutes: number;
  };
  readonly csrf: {
    readonly enabled: boolean;
    readonly cookieName: string;
    readonly headerName: string;
  };
}

@Controller('auth')
export class AuthClientConfigController {
  private readonly authConfig: AuthConfig;

  constructor(configService: ConfigService) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  @Get('client-config')
  @Public()
  @Header('Cache-Control', 'no-store')
  getClientConfig(): AuthClientConfigResponse {
    return {
      passwordPolicy: {
        minimumLength: PasswordPolicy.MIN_LENGTH,
        maximumLength: PasswordPolicy.MAX_LENGTH,
        maximumBytes: PasswordPolicy.MAX_BYTES,
        requireLowercase: PasswordPolicy.REQUIRE_LOWERCASE,
        requireUppercase: PasswordPolicy.REQUIRE_UPPERCASE,
        requireNumber: PasswordPolicy.REQUIRE_NUMBER,
        requireSymbol: PasswordPolicy.REQUIRE_SYMBOL,
      },
      passwordReset: {
        tokenExpiresInMinutes: PasswordResetPolicy.TTL_MINUTES,
      },
      csrf: {
        enabled: this.authConfig.csrf.enabled,
        cookieName: this.authConfig.csrf.cookieName,
        headerName: CSRF_HEADER_NAME,
      },
    };
  }
}
