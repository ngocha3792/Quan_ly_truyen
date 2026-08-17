import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  AccessDeniedException,
  ConfigurationException,
} from '@/common/exceptions';

import { SECURITY_LIMITS } from '@/common/constants';

import {
  generateSecureToken,
  hmacSha256,
  sha256,
  timingSafeEqualStrings,
} from '@/common/utils';

import type { AuthConfig } from '@/config';

import type { CsrfTokenPort, ValidateCsrfTokenInput } from '../../application/ports';

const CSRF_TOKEN_VERSION = 'v1';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;


@Injectable()
export class CsrfTokenAdapter implements CsrfTokenPort {
  private readonly config: AuthConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<AuthConfig>('auth');

    if (
      this.config.csrf.enabled &&
      this.config.csrf.secret.trim().length < 32
    ) {
      throw new ConfigurationException({
        code: 'AUTH_CSRF_SECRET_INVALID',

        message: 'CSRF secret không hợp lệ',

        key: 'AUTH_CSRF_SECRET',
      });
    }
  }

  isEnabled(): boolean {
    return this.config.csrf.enabled;
  }

  /**
   * Tạo signed double-submit token.
   *
   * Token được ràng buộc với:
   * - refresh token hiện tại;
   * - thời điểm hết hạn refresh token;
   * - random nonce.
   *
   * Khi refresh token rotation, CSRF token
   * cũng phải được rotation.
   */
  issue(
    refreshToken: string,

    expiresAt: Date,
  ): string | undefined {
    if (!this.config.csrf.enabled) {
      return undefined;
    }

    if (
      !refreshToken ||
      !(expiresAt instanceof Date) ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      throw new ConfigurationException({
        code: 'AUTH_CSRF_ISSUE_INPUT_INVALID',

        message: 'Không thể tạo CSRF token',
      });
    }

    const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000);

    const nonce = generateSecureToken(32, 'base64url');

    const signature = this.createSignature(
      refreshToken,

      CSRF_TOKEN_VERSION,

      expiresAtSeconds,

      nonce,
    );

    return [
      CSRF_TOKEN_VERSION,

      expiresAtSeconds.toString(),

      nonce,

      signature,
    ].join('.');
  }

  assertValid(input: ValidateCsrfTokenInput): void {
    if (!this.config.csrf.enabled) {
      return;
    }

    const cookieToken = input.cookieToken?.trim();

    const headerToken = input.headerToken?.trim();

    if (!cookieToken || !headerToken) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_REQUIRED',

        message: 'CSRF token là bắt buộc',
      });
    }

    if (
      cookieToken.length > SECURITY_LIMITS.MAX_CSRF_TOKEN_LENGTH ||
      headerToken.length > SECURITY_LIMITS.MAX_CSRF_TOKEN_LENGTH
    ) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_MALFORMED',

        message: 'CSRF token không hợp lệ',
      });
    }

    /*
     * Double-submit:
     * cookie và request header phải giống nhau.
     */
    if (
      !timingSafeEqualStrings(
        cookieToken,

        headerToken,
      )
    ) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_MISMATCH',

        message: 'CSRF token không hợp lệ',
      });
    }

    const parts = cookieToken.split('.');

    if (parts.length !== 4) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_MALFORMED',

        message: 'CSRF token không hợp lệ',
      });
    }

    const [version, expiresAtRaw, nonce, suppliedSignature] = parts;

    if (
      version !== CSRF_TOKEN_VERSION ||
      !expiresAtRaw ||
      !nonce ||
      !suppliedSignature ||
      !BASE64URL_PATTERN.test(nonce) ||
      !BASE64URL_PATTERN.test(suppliedSignature)
    ) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_MALFORMED',

        message: 'CSRF token không hợp lệ',
      });
    }

    const expiresAtSeconds = Number(expiresAtRaw);

    if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= 0) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_MALFORMED',

        message: 'CSRF token không hợp lệ',
      });
    }

    if (Date.now() >= expiresAtSeconds * 1000) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_EXPIRED',

        message: 'CSRF token đã hết hạn',
      });
    }

    const expectedSignature = this.createSignature(
      input.refreshToken,

      version,

      expiresAtSeconds,

      nonce,
    );

    /*
     * Chữ ký ràng buộc token với refresh
     * token hiện tại.
     *
     * CSRF token cũ không dùng được sau
     * refresh-token rotation.
     */
    if (
      !timingSafeEqualStrings(
        suppliedSignature,

        expectedSignature,
      )
    ) {
      throw new AccessDeniedException({
        code: 'AUTH_CSRF_TOKEN_INVALID',

        message: 'CSRF token không hợp lệ',
      });
    }
  }

  private createSignature(
    refreshToken: string,

    version: string,

    expiresAtSeconds: number,

    nonce: string,
  ): string {
    const refreshTokenFingerprint = sha256(refreshToken, 'base64url');

    const signedValue = [
      version,

      expiresAtSeconds.toString(),

      nonce,

      refreshTokenFingerprint,
    ].join('.');

    return hmacSha256(
      signedValue,

      this.config.csrf.secret,

      'base64url',
    );
  }
}
