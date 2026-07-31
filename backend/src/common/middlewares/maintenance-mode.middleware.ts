import { timingSafeEqual } from 'node:crypto';

import {
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { ServiceUnavailableException } from '@/common/exceptions';

import {
  COMMON_MIDDLEWARE_OPTIONS,
  DEFAULT_MAINTENANCE_ALLOWED_PATHS,
} from './common-middlewares.constants';
import type {
  CommonMiddlewaresOptions,
  MaintenanceModeState,
} from './common-middlewares-options.interface';
import {
  nonEmptyString,
  readHeader,
} from './middleware-request.util';
import type {
  MiddlewareHttpRequest,
  MiddlewareHttpResponse,
  MiddlewareNext,
} from './request-context.interface';

function normalizePath(path: string): string {
  return path.split('?', 1)[0] ?? path;
}

function safeTokenEquals(
  supplied: string | undefined,
  expected: string | undefined,
): boolean {
  if (!supplied || !expected) {
    return false;
  }

  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);

  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

@Injectable()
export class MaintenanceModeMiddleware
  implements NestMiddleware {
  constructor(
    @Inject(COMMON_MIDDLEWARE_OPTIONS)
    private readonly options: CommonMiddlewaresOptions,
  ) { }

  async use(
    request: MiddlewareHttpRequest,
    response: MiddlewareHttpResponse,
    next: MiddlewareNext,
  ): Promise<void> {
    const maintenanceOptions =
      this.options.maintenance;

    if (!maintenanceOptions?.resolveState) {
      next();
      return;
    }

    let state: MaintenanceModeState;

    try {
      state = await maintenanceOptions.resolveState();
    } catch {
      // Fail open: lỗi đọc cấu hình không được tự biến hệ thống
      // thành unavailable. Hãy giám sát lỗi resolver riêng.
      next();
      return;
    }

    if (!state.enabled) {
      next();
      return;
    }

    const path = normalizePath(
      nonEmptyString(request.originalUrl) ??
      nonEmptyString(request.url) ??
      '/',
    );
    const allowedPaths =
      maintenanceOptions.allowedPaths ??
      DEFAULT_MAINTENANCE_ALLOWED_PATHS;

    if (allowedPaths.includes(path)) {
      next();
      return;
    }

    const bypassHeaderName =
      maintenanceOptions.bypassHeaderName;
    const bypassValue = bypassHeaderName
      ? readHeader(request.headers, bypassHeaderName)
      : undefined;

    if (
      safeTokenEquals(
        bypassValue,
        maintenanceOptions.bypassToken,
      )
    ) {
      next();
      return;
    }

    if (
      state.retryAfterSeconds !== undefined &&
      Number.isFinite(state.retryAfterSeconds) &&
      state.retryAfterSeconds > 0
    ) {
      response.setHeader(
        'retry-after',
        Math.floor(state.retryAfterSeconds),
      );
    }

    next(
      new ServiceUnavailableException({
        code: 'MAINTENANCE_MODE',
        message:
          state.message ??
          'Hệ thống đang bảo trì, vui lòng thử lại sau',
        details: state.retryAfterSeconds ? { retryAfterSeconds: state.retryAfterSeconds } : undefined,
      }),
    );
  }
}
