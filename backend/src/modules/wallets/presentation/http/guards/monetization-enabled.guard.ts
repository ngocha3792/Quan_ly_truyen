import type { CanActivate } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ServiceUnavailableException } from '@/common/exceptions';
import type { MonetizationConfig } from '@/config';

@Injectable()
export class MonetizationEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    const config =
      this.configService.getOrThrow<MonetizationConfig>('monetization');
    if (!config.enabled) {
      throw new ServiceUnavailableException({
        code: 'MONETIZATION_NOT_ENABLED',
        message: 'Hệ thống Credit chưa được bật',
        service: 'monetization',
      });
    }
    return true;
  }
}
