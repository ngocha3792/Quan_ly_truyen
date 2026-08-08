import { Module } from '@nestjs/common';

import { AuthAccountSecurityModule } from './auth-account-security.module';
import { AuthAuthorizationModule } from './auth-authorization.module';
import { AuthCoreModule } from './auth-core.module';
import { AuthCredentialsModule } from './auth-credentials.module';
import { AuthOAuthModule } from './auth-oauth.module';
import { AuthSessionsModule } from './auth-sessions.module';

@Module({
  imports: [
    AuthAuthorizationModule,
    AuthCoreModule,
    AuthCredentialsModule,
    AuthSessionsModule,
    AuthAccountSecurityModule,
    AuthOAuthModule,
  ],
  exports: [AuthCoreModule, AuthAuthorizationModule],
})
export class AuthModule {}
