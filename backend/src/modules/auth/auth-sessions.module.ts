import { Module } from '@nestjs/common';

import {
  LoginCommandHandler,
  LogoutAllCommandHandler,
  LogoutCommandHandler,
  RefreshTokenCommandHandler,
  RevokeAccessTokenCommandHandler,
} from './application';
import {
  AuthClientConfigController,
  AuthTokenController,
  RefreshCookieCsrfGuard,
} from './presentation/http';

import { AuthCoreModule } from './auth-core.module';

@Module({
  imports: [AuthCoreModule],
  controllers: [AuthClientConfigController, AuthTokenController],
  providers: [
    LoginCommandHandler,
    LogoutCommandHandler,
    LogoutAllCommandHandler,
    RefreshTokenCommandHandler,
    RevokeAccessTokenCommandHandler,
    RefreshCookieCsrfGuard,
  ],
})
export class AuthSessionsModule {}
