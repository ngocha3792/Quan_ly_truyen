import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { RoleCode } from '@/common/enums';
import type { AuthConfig } from '@/config';
import { OAuthProvider } from '@/generated/prisma/client';

import { OAuthFlowInvalidException } from '../../domain/exceptions';

import { OAuthFlowService } from './oauth-flow.service';

describe('OAuthFlowService state protection', () => {
  const authConfig = {
    oauth: {
      enabled: true,
      stateTtlSeconds: 600,
      stateCookieName: 'oauth_state',
      google: {
        enabled: true,
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        callbackUrl:
          'https://api.example.com/api/v1/auth/oauth/google/callback',
      },
      github: { enabled: false },
    },
  } as AuthConfig;

  function createService(
    redisOverrides: Partial<Redis> = {},
    dependencies: {
      prisma?: unknown;
      adminMfa?: unknown;
      auditWriter?: unknown;
      loginPersistence?: unknown;
      tokenIssuer?: unknown;
      secureToken?: unknown;
      idGenerator?: unknown;
    } = {},
  ) {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      getdel: jest.fn().mockResolvedValue(null),
      ...redisOverrides,
    } as unknown as Redis;

    return {
      redis,
      service: new OAuthFlowService(
        new ConfigService({ auth: authConfig }),
        redis,
        dependencies.prisma as never,
        dependencies.adminMfa as never,
        dependencies.auditWriter as never,
        dependencies.loginPersistence as never,
        dependencies.tokenIssuer as never,
        dependencies.secureToken as never,
        dependencies.idGenerator as never,
      ),
    };
  }

  it('stores one-time state and returns PKCE authorization metadata', async () => {
    const { redis, service } = createService();

    const result = await service.createAuthorizationUrl('google', {
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent',
    });

    const url = new URL(result.url);
    expect(result.state).toHaveLength(43);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(url.searchParams.get('state')).toBe(result.state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:oauth:state:/u),
      expect.any(String),
      'EX',
      600,
      'NX',
    );
  });

  it('rejects a callback not bound to the initiating browser', async () => {
    const { redis, service } = createService();

    await expect(
      service.complete(
        'google',
        'authorization-code',
        'query-state',
        'other-browser-state',
        undefined,
        {},
      ),
    ).rejects.toBeInstanceOf(OAuthFlowInvalidException);
    expect(redis.getdel).not.toHaveBeenCalled();
  });

  it('consumes state even when the provider callback is cancelled', async () => {
    const stateRecord = JSON.stringify({
      provider: 'google',
      verifier: 'pkce-verifier',
      nonce: 'nonce',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      client: {},
    });
    const getdel = jest.fn().mockResolvedValue(stateRecord);
    const { service } = createService({ getdel });

    await expect(
      service.complete(
        'google',
        undefined,
        'same-state',
        'same-state',
        'access_denied',
        {},
      ),
    ).rejects.toBeInstanceOf(OAuthFlowInvalidException);
    expect(getdel).toHaveBeenCalledTimes(1);
  });

  it('requires MFA for an OAuth admin before issuing a session', async () => {
    const stateRecord = JSON.stringify({
      provider: 'google',
      verifier: 'pkce-verifier',
      nonce: 'nonce',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      client: { deviceName: 'Browser' },
    });
    const adminMfa = {
      isEnabled: jest.fn().mockReturnValue(true),
      create: jest.fn().mockResolvedValue({
        ticket: 'mfa-ticket',
        mode: 'verify',
        expiresAt: new Date(Date.now() + 300_000),
      }),
    };
    const loginPersistence = { createSession: jest.fn() };
    const tokenIssuer = { issue: jest.fn() };
    const { service } = createService(
      { getdel: jest.fn().mockResolvedValue(stateRecord) },
      { adminMfa, loginPersistence, tokenIssuer },
    );
    Object.assign(service, {
      googleProfile: jest.fn().mockResolvedValue({
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-account-id',
        email: 'admin@example.com',
        emailVerified: true,
        displayName: 'Admin',
        usernameHint: 'admin',
      }),
      resolveAccount: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'admin@example.com',
        username: 'admin',
        displayName: 'Admin',
        passwordHash: null,
        status: 'ACTIVE',
        deletedAt: null,
        emailVerifiedAt: new Date(),
        roles: [RoleCode.ADMIN],
        mfaEnabled: true,
      }),
    });

    await expect(
      service.complete(
        'google',
        'authorization-code',
        'same-state',
        'same-state',
        undefined,
        { ipAddress: '203.0.113.20' },
      ),
    ).rejects.toMatchObject({ code: 'AUTH_ADMIN_MFA_REQUIRED' });

    expect(adminMfa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'verify',
        source: 'google',
        client: expect.objectContaining({
          ipAddress: '203.0.113.20',
          deviceName: 'Browser',
        }),
      }),
    );
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
    expect(loginPersistence.createSession).not.toHaveBeenCalled();
  });
});
