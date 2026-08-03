import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { CSRF_HEADER_NAME } from '@/common/constants';
import type { AuthConfig } from '@/config';

import { InvalidRefreshTokenException } from '../../../domain/exceptions';
import { CsrfTokenService } from '../../../infrastructure/security';

import { readCookieFromHeader } from './cookie-header-reader';

@Injectable()
export class AuthCookieService {
  private readonly authConfig: AuthConfig;

  constructor(
    configService: ConfigService,

    private readonly csrfTokenService: CsrfTokenService,
  ) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  readRequiredRefreshToken(cookieHeader: string | undefined): string {
    const result = readCookieFromHeader(
      cookieHeader,

      this.authConfig.refreshCookie.name,
    );

    if (result.status === 'valid') {
      return result.value;
    }

    /*
     * Missing, duplicate và malformed đều trả cùng
     * một lỗi public.
     */
    throw new InvalidRefreshTokenException();
  }

  readOptionalRefreshToken(
    cookieHeader: string | undefined,
  ): string | undefined {
    const result = readCookieFromHeader(
      cookieHeader,

      this.authConfig.refreshCookie.name,
    );

    /*
     * Logout không có cookie vẫn idempotent.
     */
    if (result.status === 'missing') {
      return undefined;
    }

    if (result.status === 'valid') {
      return result.value;
    }

    /*
     * Có credential cookie nhưng bị duplicate/malformed
     * thì không được coi là cookie bị thiếu.
     */
    throw new InvalidRefreshTokenException();
  }

  setAuthCookies(
    response: Response,

    refreshToken: string,

    expiresAt: Date,
  ): void {
    response.cookie(
      this.authConfig.refreshCookie.name,

      refreshToken,

      this.createRefreshCookieOptions(expiresAt),
    );

    const csrfToken = this.csrfTokenService.issue(
      refreshToken,

      expiresAt,
    );

    if (!csrfToken) {
      /*
       * Ngoài production, CSRF có thể bị tắt.
       * Khi đó phải xóa cookie CSRF cũ.
       */
      this.clearCsrfTokenCookie(response);

      return;
    }

    response.cookie(
      this.authConfig.csrf.cookieName,

      csrfToken,

      this.createCsrfCookieOptions(expiresAt),
    );

    /*
     * Frontend có thể đọc token từ response header
     * hoặc cookie không HttpOnly.
     */
    response.setHeader(
      CSRF_HEADER_NAME,

      csrfToken,
    );
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie(
      this.authConfig.refreshCookie.name,

      this.createRefreshCookieOptions(),
    );

    this.clearCsrfTokenCookie(response);
  }

  setNoStoreHeaders(response: Response): void {
    response.setHeader(
      'Cache-Control',

      'no-store, private',
    );

    response.setHeader(
      'Pragma',

      'no-cache',
    );
  }

  private clearCsrfTokenCookie(response: Response): void {
    response.clearCookie(
      this.authConfig.csrf.cookieName,

      this.createCsrfCookieOptions(),
    );
  }

  private createRefreshCookieOptions(expiresAt?: Date): CookieOptions {
    const cookie = this.authConfig.refreshCookie;

    const options: CookieOptions = {
      httpOnly: true,

      secure: cookie.secure,

      sameSite: cookie.sameSite,

      path: cookie.path,
    };

    if (expiresAt) {
      options.expires = expiresAt;
    }

    if (cookie.domain) {
      options.domain = cookie.domain;
    }

    return options;
  }

  private createCsrfCookieOptions(expiresAt?: Date): CookieOptions {
    const csrf = this.authConfig.csrf;

    const refreshCookie = this.authConfig.refreshCookie;

    const options: CookieOptions = {
      /*
       * Double-submit CSRF cookie phải được frontend đọc.
       */
      httpOnly: false,

      secure: refreshCookie.secure,

      sameSite: refreshCookie.sameSite,

      path: csrf.cookiePath,
    };

    if (expiresAt) {
      options.expires = expiresAt;
    }

    if (csrf.cookieDomain) {
      options.domain = csrf.cookieDomain;
    }

    return options;
  }
}
