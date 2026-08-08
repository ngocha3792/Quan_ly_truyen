import { Module } from '@nestjs/common';

import { AUTHORIZATION_INVALIDATION_PORT } from '@/common/interfaces/auth';

import { CacheModule } from '@/infrastructure/cache';

import { AccessAuthorizationCacheService } from './infrastructure';

@Module({
  imports: [CacheModule],

  providers: [
    AccessAuthorizationCacheService,

    {
      provide: AUTHORIZATION_INVALIDATION_PORT,

      useExisting: AccessAuthorizationCacheService,
    },
  ],

  exports: [
    /*
     * Auth nội bộ vẫn cần get/set snapshot.
     */
    AccessAuthorizationCacheService,

    /*
     * Module bên ngoài chỉ cần biết port này.
     */
    AUTHORIZATION_INVALIDATION_PORT,
  ],
})
export class AuthAuthorizationModule {}
