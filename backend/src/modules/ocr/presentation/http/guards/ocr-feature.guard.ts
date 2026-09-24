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
export class OcrFeatureGuard implements CanActivate {
  constructor(
    @Inject(readerFeaturesConfig.KEY)
    private readonly features: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (!this.features.ocrEnabled) {
      throw new ServiceUnavailableException({
        code: 'OCR_DISABLED',
        message: 'Tính năng nhận dạng chữ trong ảnh hiện chưa được bật',
      });
    }
    return true;
  }
}
