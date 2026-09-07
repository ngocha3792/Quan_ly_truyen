import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { ServiceUnavailableException } from '@/common/exceptions';
import { monetizationConfig } from '@/config';

@Injectable()
export class MonetizationFeatureGuard implements CanActivate {
  constructor(
    @Inject(monetizationConfig.KEY)
    private readonly config: ConfigType<typeof monetizationConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (!this.config.enabled) {
      throw new ServiceUnavailableException({
        code: 'MONETIZATION_DISABLED',
        message: 'Tính năng Credit hiện chưa được bật',
      });
    }
    return true;
  }
}

@Injectable()
export class AuthorPricingFeatureGuard implements CanActivate {
  constructor(
    @Inject(monetizationConfig.KEY)
    private readonly config: ConfigType<typeof monetizationConfig>,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    void _context;
    if (!this.config.enabled || !this.config.authorPricingEnabled) {
      throw new ServiceUnavailableException({
        code: 'AUTHOR_PRICING_DISABLED',
        message: 'Cấu hình giá chương hiện chưa được bật',
      });
    }
    return true;
  }
}
