import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '@/infrastructure/database/prisma';
import { AccessTokenValidationService } from './services/access-token-validation.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [PassportModule.register({ session: false }), PrismaModule],
  providers: [AccessTokenValidationService, JwtAccessStrategy],
  exports: [PassportModule, AccessTokenValidationService],
})
export class AuthModule {}
