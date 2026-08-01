import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '@/infrastructure/database/prisma';
import { OutboxCoreModule } from '@/infrastructure/queue/outbox/outbox-core.module';
import { AuthController } from './auth.controller';
import { AccessTokenValidationService } from './services/access-token-validation.service';
import { RegistrationService } from './services/registration.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    PrismaModule,
    OutboxCoreModule,
  ],
  controllers: [AuthController],
  providers: [
    AccessTokenValidationService,
    RegistrationService,
    JwtAccessStrategy,
  ],
  exports: [PassportModule, AccessTokenValidationService],
})
export class AuthModule {}
