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
export class TtsFeatureGuard implements CanActivate {
  constructor(
    @Inject(readerFeaturesConfig.KEY)
    private readonly features: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (!this.features.textToSpeechEnabled) {
      throw new ServiceUnavailableException({
        code: 'TTS_DISABLED',
        message: 'Tính năng tạo giọng đọc hiện chưa được bật',
      });
    }
    return true;
  }
}
