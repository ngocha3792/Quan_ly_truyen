import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type { Request } from 'express';

import { CSRF_HEADER_NAME } from '@/common/constants';

import { AccessDeniedException } from '@/common/exceptions';

import type { AuthConfig, CorsConfig } from '@/config';

import { InvalidRefreshTokenException } from '../../../domain/exceptions';

import { CSRF_TOKEN_PORT, type CsrfTokenPort } from '../../../application/ports';

import { readCookieFromHeader } from '../cookies';

@Injectable()
export class RefreshCookieCsrfGuard implements CanActivate {
  private readonly authConfig: AuthConfig;

  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(
    configService: ConfigService,

    @Inject(CSRF_TOKEN_PORT)
    private readonly csrfTokenService: CsrfTokenPort,
  ) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');

    const corsConfig = configService.getOrThrow<CorsConfig>('cors');

    this.allowedOrigins = new Set(corsConfig.allowedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    /*
     * Khi CSRF bị tắt, controller vẫn tự parse refresh cookie
     * bằng parser dùng chung và vẫn reject duplicate/malformed.
     */
    if (!this.csrfTokenService.isEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const cookieHeader = request.headers.cookie;

    const refreshCookie = readCookieFromHeader(
      cookieHeader,

      this.authConfig.refreshCookie.name,
    );

    /*
     * Không có refresh cookie:
     *
     * - refresh controller sẽ trả InvalidRefreshTokenException;
     * - logout vẫn giữ tính idempotent.
     *
     * CSRF chỉ cần kiểm tra khi browser thực sự gửi
     * refresh credential cookie.
     */
    if (refreshCookie.status === 'missing') {
      return true;
    }

    /*
     * Không tự chọn một giá trị khi có duplicate cookie.
     *
     * malformed và duplicate đều được trả về cùng một lỗi
     * public để không tiết lộ chi tiết parser/security.
     */
    if (refreshCookie.status !== 'valid') {
      throw new InvalidRefreshTokenException();
    }

    this.assertAllowedOrigin(readSingleHeader(request.headers.origin));

    const csrfCookie = readCookieFromHeader(
      cookieHeader,

      this.authConfig.csrf.cookieName,
    );

    /*
     * Missing CSRF cookie được chuyển tiếp dưới dạng undefined
     * để CsrfTokenAdapter trả AUTH_CSRF_TOKEN_REQUIRED.
     */
    if (
      csrfCookie.status === 'malformed' ||
      csrfCookie.status === 'duplicate'
    ) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_MALFORMED',

        message: 'CSRF token không hợp lệ',
      });
    }

    const csrfHeader = readSingleHeader(request.headers[CSRF_HEADER_NAME]);

    this.csrfTokenService.assertValid({
      refreshToken: refreshCookie.value,

      cookieToken: csrfCookie.status === 'valid' ? csrfCookie.value : undefined,

      headerToken: csrfHeader,
    });

    return true;
  }

  private assertAllowedOrigin(origin: string | undefined): void {
    /*
     * Mobile app, server-to-server và curl có thể không gửi Origin.
     *
     * Khi browser gửi Origin thì bắt buộc Origin nằm trong
     * CORS allowlist.
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
