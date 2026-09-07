import { Module } from '@nestjs/common';

import { RedisModule } from '@/infrastructure/cache/redis/redis.module';

import { MONETIZATION_RATE_LIMITER_PORT } from './application';
import { RedisMonetizationRateLimiter } from './infrastructure';

@Module({
  imports: [RedisModule],
  providers: [
    RedisMonetizationRateLimiter,
    {
      provide: MONETIZATION_RATE_LIMITER_PORT,
      useExisting: RedisMonetizationRateLimiter,
    },
  ],
  exports: [MONETIZATION_RATE_LIMITER_PORT],
})
export class MonetizationSecurityModule {}
