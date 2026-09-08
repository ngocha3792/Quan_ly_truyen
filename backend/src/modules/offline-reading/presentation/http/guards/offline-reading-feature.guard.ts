import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ServiceUnavailableException } from '@/common/exceptions';
import { readerFeaturesConfig } from '@/config';

@Injectable()
export class OfflineReadingFeatureGuard implements CanActivate {
  constructor(
    @Inject(readerFeaturesConfig.KEY)
    private readonly features: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (!this.features.offlineReadingEnabled) {
      throw new ServiceUnavailableException({
        code: 'OFFLINE_READING_DISABLED',
        message: 'Tính năng đọc offline hiện chưa được bật',
      });
    }
    return true;
  }
}
