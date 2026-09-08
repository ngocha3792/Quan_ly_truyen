import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { MediaModule } from '@/modules/media';

import {
  CreateOfflinePackageCommandHandler,
  DeleteOfflinePackageCommandHandler,
  GetOfflinePackageManifestQueryHandler,
  GetOfflineQuotaQueryHandler,
  ListOfflinePackagesQueryHandler,
  OFFLINE_READING_PERSISTENCE_PORT,
  TouchOfflinePackageCommandHandler,
} from './application';
import { PrismaOfflineReadingPersistence } from './infrastructure';
import {
  OfflinePackagesController,
  OfflineReadingFeatureGuard,
} from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, MediaModule],
  controllers: [OfflinePackagesController],
  providers: [
    CreateOfflinePackageCommandHandler,
    DeleteOfflinePackageCommandHandler,
    TouchOfflinePackageCommandHandler,
    ListOfflinePackagesQueryHandler,
    GetOfflineQuotaQueryHandler,
    GetOfflinePackageManifestQueryHandler,
    OfflineReadingFeatureGuard,
    PrismaOfflineReadingPersistence,
    {
      provide: OFFLINE_READING_PERSISTENCE_PORT,
      useExisting: PrismaOfflineReadingPersistence,
    },
  ],
})
export class OfflineReadingModule {}
