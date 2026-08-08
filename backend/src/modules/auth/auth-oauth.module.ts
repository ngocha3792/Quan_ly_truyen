import { Module } from '@nestjs/common';

import { OAuthController } from './presentation/http';

import { AuthCoreModule } from './auth-core.module';

@Module({
  imports: [AuthCoreModule],
  controllers: [OAuthController],
})
export class AuthOAuthModule {}
