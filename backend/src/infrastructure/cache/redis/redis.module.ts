import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

import { redisClientProvider } from './redis.client.provider';
import { REDIS_CLIENT } from './redis.constants';

@Module({
  providers: [redisClientProvider],
  exports: [redisClientProvider],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {
        this.redisClient?.disconnect();
      });
    }
  }
}
