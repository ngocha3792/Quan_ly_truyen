import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type { Request } from 'express';

import { CSRF_HEADER_NAME } from '@/common/constants';

import { AccessDeniedException } from '@/common/exceptions';

import type { AuthConfig, CorsConfig } from '@/config';

import { CsrfTokenService } from '../../../infrastructure/security';

@Injectable()
export class RefreshCookieCsrfGuard implements CanActivate {
  private readonly authConfig: AuthConfig;

  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(
    configService: ConfigService,

    private readonly csrfTokenService: CsrfTokenService,
  ) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');

    const corsConfig = configService.getOrThrow<CorsConfig>('cors');

    this.allowedOrigins = new Set(corsConfig.allowedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.csrfTokenService.isEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const cookieHeader = request.headers.cookie;

    const refreshToken = readCookie(
      cookieHeader,

      this.authConfig.refreshCookie.name,
    );

    /*
     * Không có refresh cookie:
     *
     * - refresh controller sẽ trả
     *   InvalidRefreshTokenException;
     *
     * - logout vẫn giữ tính idempotent.
     *
     * CSRF chỉ có ý nghĩa khi browser
     * tự động gửi credential cookie.
     */
    if (!refreshToken) {
      return true;
    }

    this.assertAllowedOrigin(readSingleHeader(request.headers.origin));

    const csrfCookie = readCookie(
      cookieHeader,

      this.authConfig.csrf.cookieName,
    );

    const csrfHeader = readSingleHeader(request.headers[CSRF_HEADER_NAME]);

    this.csrfTokenService.assertValid({
      refreshToken,

      cookieToken: csrfCookie,

      headerToken: csrfHeader,
    });

    return true;
  }

  private assertAllowedOrigin(origin: string | undefined): void {
    /*
     * Mobile app, server-to-server và curl
     * có thể không gửi Origin.
     *
     * Khi browser gửi Origin thì bắt buộc
     * Origin nằm trong CORS allowlist.
     */
    if (!origin) {
      return;
    }

    if (!this.allowedOrigins.has(origin)) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_ORIGIN_REJECTED',

        message: 'Nguồn request không được phép',
      });
    }
  }
}

function readSingleHeader(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();

    return normalized || undefined;
  }

  if (Array.isArray(value) && value.length === 1) {
    const first: unknown = value[0];

    if (typeof first === 'string') {
      const normalized = first.trim();

      return normalized || undefined;
    }
  }

  return undefined;
}

function readCookie(
  cookieHeader: string | undefined,

  cookieName: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  let found: string | undefined;

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();

    if (name !== cookieName) {
      continue;
    }

    /*
     * Duplicate cookie name bị từ chối
     * để tránh parser ambiguity.
     */
    if (found !== undefined) {
      return undefined;
    }

    const encodedValue = part.slice(separatorIndex + 1).trim();

    if (!encodedValue) {
      return undefined;
    }

    try {
      const decodedValue = decodeURIComponent(encodedValue);

      if (!decodedValue) {
        return undefined;
      }

      found = decodedValue;
    } catch {
      return undefined;
    }
  }

  return found;
}
