import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CSRF_HEADER_NAME } from '@/common/constants';
import { Public } from '@/common/decorators';
import type { AuthConfig } from '@/config';

export interface AuthClientConfigResponse {
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
      csrf: {
        enabled: this.authConfig.csrf.enabled,
        cookieName: this.authConfig.csrf.cookieName,
        headerName: CSRF_HEADER_NAME,
      },
    };
  }
}
