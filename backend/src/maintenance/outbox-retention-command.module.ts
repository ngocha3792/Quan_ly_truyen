import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config';

import { PrismaModule } from '@/infrastructure/database';

import { OutboxRetentionService } from '@/infrastructure/queue/outbox';

@Module({
  imports: [AppConfigModule, PrismaModule],

  providers: [OutboxRetentionService],

  exports: [OutboxRetentionService],
})
export class OutboxRetentionCommandModule {}
