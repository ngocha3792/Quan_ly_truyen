import { Module } from '@nestjs/common';

import { CacheModule } from './cache';
import { PrismaModule } from './database';
import { IdempotencyModule } from './idempotency';
import { LockModule } from './lock';
import { QueueModule } from './queue';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    LockModule,
    IdempotencyModule,
    QueueModule.register(),
  ],
  exports: [
    PrismaModule,
    CacheModule,
    LockModule,
    IdempotencyModule,
    QueueModule,
  ],
})
export class InfrastructureModule {}
