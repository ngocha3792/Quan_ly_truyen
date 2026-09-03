import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { API_PATHS, CSRF_HEADER_NAME } from '@/common/constants';
import type { AuthConfig } from '@/config';

import {
  InvalidRefreshTokenException,
  OAuthFlowInvalidException,
} from '../../../domain/exceptions';
import {
  CSRF_TOKEN_PORT,
  type CsrfTokenPort,
} from '../../../application/ports';

import { readCookieFromHeader } from './cookie-header-reader';

const OAUTH_COOKIE_PATH = API_PATHS.AUTH_OAUTH;

@Injectable()
export class AuthCookieManager {
  private readonly authConfig: AuthConfig;

  constructor(
    configService: ConfigService,
    @Inject(CSRF_TOKEN_PORT)
    private readonly csrfTokenService: CsrfTokenPort,
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

  readRequiredOAuthState(cookieHeader: string | undefined): string {
    const result = readCookieFromHeader(
      cookieHeader,
      this.authConfig.oauth.stateCookieName,
    );

    if (result.status === 'valid') {
      return result.value;
    }

    throw new OAuthFlowInvalidException();
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

    const csrfToken = this.csrfTokenService.issue(refreshToken, expiresAt);

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
    response.setHeader(CSRF_HEADER_NAME, csrfToken);
  }

  setOAuthStateCookie(
    response: Response,
    state: string,
    expiresAt: Date,
  ): void {
    response.cookie(
      this.authConfig.oauth.stateCookieName,
      state,
      this.createOAuthStateCookieOptions(expiresAt),
    );
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie(
      this.authConfig.refreshCookie.name,
      this.createRefreshCookieOptions(),
    );
    this.clearCsrfTokenCookie(response);
  }

  clearOAuthStateCookie(response: Response): void {
    response.clearCookie(
      this.authConfig.oauth.stateCookieName,
      this.createOAuthStateCookieOptions(),
    );
  }

  setNoStoreHeaders(response: Response): void {
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('Pragma', 'no-cache');
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

  private createOAuthStateCookieOptions(expiresAt?: Date): CookieOptions {
    const refreshCookie = this.authConfig.refreshCookie;
    const options: CookieOptions = {
      httpOnly: true,
      secure: refreshCookie.secure,
      /*
       * OAuth callback là top-level cross-site navigation từ provider,
       * vì vậy cookie state phải dùng SameSite=Lax.
       */
      sameSite: 'lax',
      path: OAUTH_COOKIE_PATH,
    };

    if (expiresAt) {
      options.expires = expiresAt;
    }

    /*
     * Giữ host-only để sibling subdomain không thể ghi đè OAuth state.
     * Endpoint bắt đầu và callback phải nằm trên cùng API host.
     */
    return options;
  }
}
