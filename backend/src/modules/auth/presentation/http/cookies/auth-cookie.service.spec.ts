import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import type { AuthConfig } from '@/config';

import { OAuthFlowInvalidException } from '../../../domain/exceptions';
import type { CsrfTokenService } from '../../../infrastructure/security';

import { AuthCookieService } from './auth-cookie.service';

describe('AuthCookieService OAuth state cookie', () => {
  const authConfig = {
    refreshCookie: {
      name: 'refresh_token',
      secure: true,
      sameSite: 'strict',
      domain: 'api.example.com',
      path: '/api/v1/auth',
    },
    oauth: {
      enabled: true,
      stateTtlSeconds: 600,
      stateCookieName: 'oauth_state',
      google: { enabled: true },
      github: { enabled: false },
    },
    csrf: {
      enabled: true,
      secret: 'csrf-secret-with-at-least-32-characters',
      cookieName: 'csrf_token',
      cookieDomain: 'api.example.com',
      cookiePath: '/',
    },
  } as AuthConfig;

  const service = new AuthCookieService(
    new ConfigService({ auth: authConfig }),
    { issue: jest.fn() } as unknown as CsrfTokenService,
  );

  it('sets a short-lived HttpOnly SameSite=Lax cookie for OAuth state', () => {
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;
    const expiresAt = new Date('2026-08-04T10:20:00.000Z');

    service.setOAuthStateCookie(response, 'browser-state', expiresAt);

    expect(response.cookie).toHaveBeenCalledWith(
      'oauth_state',
      'browser-state',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/v1/auth/oauth',
        expires: expiresAt,
      }),
    );
  });

  it('accepts exactly one state cookie and rejects duplicates', () => {
    expect(service.readRequiredOAuthState('oauth_state=state-value')).toBe(
      'state-value',
    );

    expect(() =>
      service.readRequiredOAuthState(
        'oauth_state=state-one; oauth_state=state-two',
      ),
    ).toThrow(OAuthFlowInvalidException);
  });
});
