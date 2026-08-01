import { createHash, timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ObservabilityConfig } from '@/config';

interface MetricsRequest {
  headers?: Record<string, unknown>;
  ip?: unknown;
  socket?: { remoteAddress?: unknown };
}

@Injectable()
export class MetricsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const config =
      this.configService.getOrThrow<ObservabilityConfig>('observability');
    if (!config.enabled || !config.metrics.enabled) {
      throw new NotFoundException();
    }

    const request = context.switchToHttp().getRequest<MetricsRequest>();
    const expected = config.metrics.bearerToken;
    if (!expected && process.env.NODE_ENV !== 'production') {
      if (isLoopback(request.ip) || isLoopback(request.socket?.remoteAddress)) {
        return true;
      }
    }

    const authorization = request.headers?.authorization;
    const supplied =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : '';
    if (!expected || !constantTimeEqual(supplied, expected)) {
      throw new UnauthorizedException('Metrics bearer token is invalid');
    }
    return true;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function isLoopback(value: unknown): boolean {
  return (
    value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1'
  );
}
