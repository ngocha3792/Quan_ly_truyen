import { Module } from '@nestjs/common';

import { AUTHORIZATION_INVALIDATION_PORT } from '@/common/interfaces/auth';

import { CacheModule } from '@/infrastructure/cache';

import { RedisAccessAuthorizationCacheAdapter } from './infrastructure';

@Module({
  imports: [CacheModule],

  providers: [
    RedisAccessAuthorizationCacheAdapter,

    {
      provide: AUTHORIZATION_INVALIDATION_PORT,

      useExisting: RedisAccessAuthorizationCacheAdapter,
    },
  ],

  exports: [
    /*
     * Auth nội bộ vẫn cần get/set snapshot.
     */
    RedisAccessAuthorizationCacheAdapter,

    /*
     * Module bên ngoài chỉ cần biết port này.
     */
    AUTHORIZATION_INVALIDATION_PORT,
  ],
})
export class AuthAuthorizationModule {}
