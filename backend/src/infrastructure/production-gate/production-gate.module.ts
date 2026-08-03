import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config';

import { RedisModule } from '@/infrastructure/cache/redis';

import { PrismaModule } from '@/infrastructure/database';

import { MailTransportModule } from '@/infrastructure/mail';

import { ProductionGateService } from './production-gate.service';

@Module({
  imports: [AppConfigModule, PrismaModule, RedisModule, MailTransportModule],

  providers: [ProductionGateService],

  exports: [ProductionGateService],
})
export class ProductionGateModule {}
