import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Test } from '@nestjs/testing';

import Redis from 'ioredis';

import request from 'supertest';

import { AppModule } from '@/app.module';

import { configureApplication } from '@/bootstrap';

import { RoleCode } from '@/common/enums';

import { hashPassword, verifyPassword } from '@/common/utils';

import type { AppConfig } from '@/config';

import { PrismaService } from '@/infrastructure/database';

import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '@/modules/auth/application/ports';

import { MailPayloadCipherService } from '@/infrastructure/mail/security';

import { MailTemplateId } from '@/infrastructure/mail/templates';

import {
  isEncryptedMailPayloadV1,
  SEND_MAIL_JOB,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';

describe('Auth HTTP lifecycle', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let redis: Redis;

  let cipher: MailPayloadCipherService;

  const runId = randomUUID();

  const origin = 'http://localhost:4200';

  const defaultPassword = 'StrongPass123!';

  beforeAll(async () => {
    redis = new Redis(
      requireEnvironment('TEST_REDIS_URL'),

      {
        maxRetriesPerRequest: null,
      },
    );

    await redis.flushdb();

    /*
     * Production giữ bcrypt 12 rounds.
     *
     * E2E chỉ cần kiểm tra hành vi xác thực, không benchmark bcrypt.
     * Dùng mức tối thiểu an toàn 10 rounds để tránh request
     * change-password vượt HTTP timeout trên máy chạy test chậm.
     */
    const e2ePasswordHasher = {
      hash: (plainPassword: string): Promise<string> =>
        hashPassword(plainPassword, {
          rounds: 10,
        }),

      verify: (plainPassword: string, passwordHash: string): Promise<boolean> =>
        verifyPassword(plainPassword, passwordHash),
    } satisfies PasswordHasherPort;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PASSWORD_HASHER_PORT)
      .useValue(e2ePasswordHasher)
      .compile();

    app = moduleRef.createNestApplication({
      rawBody: true,
    });

    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

    configureApplication(
      app,

      appConfig,
    );

    await app.init();

    prisma = app.get(PrismaService);

    cipher = app.get(MailPayloadCipherService);

    await prisma.role.upsert({
      where: {
        code: RoleCode.USER,
      },

      update: {},

      create: {
        code: RoleCode.USER,

        name: 'User',

        description: 'E2E default role',

        isSystem: true,
      },
    });
  });

  afterEach(async () => {
    await cleanupRun();

    await redis.flushdb();
  });

  afterAll(async () => {
    await cleanupRun();

    await app.close();

    await redis.flushdb();

    await redis.quit();
  });

  it('runs register, verify, login, me, session revoke and logout', async () => {
    const user = await registerAndVerify('lifecycle');

    const firstLogin = await login(
      user.email,

      defaultPassword,

      'first-device',
    );

    expect(firstLogin.refreshSetCookie).toContain('HttpOnly');

    expect(firstLogin.refreshSetCookie).toContain('Path=/api/v1/auth');

    expect(firstLogin.refreshSetCookie.toLowerCase()).toContain('samesite=lax');

    expect(firstLogin.csrfSetCookie).not.toContain('HttpOnly');

    expect(firstLogin.csrfSetCookie).toContain('Path=/');

    const meResponse = await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${firstLogin.accessToken}`,
      )
      .expect(200);

    const me = unwrap<{
      id: string;

      sessionId: string;

      email: string;

      emailVerified: boolean;
    }>(meResponse.body);

    expect(me).toMatchObject({
      id: user.id,

      sessionId: firstLogin.sessionId,

      email: user.email,

      emailVerified: true,
    });

    const secondLogin = await login(
      user.email,

      defaultPassword,

      'second-device',
    );

    const sessionsResponse = await request(httpServer())
      .get('/api/v1/auth/sessions')
      .set(
        'Authorization',

        `Bearer ${firstLogin.accessToken}`,
      )
      .expect(200);

    const sessions = unwrap<{
      total: number;

      sessions: Array<{
        id: string;

        isCurrent: boolean;

        deviceName: string | null;
      }>;
    }>(sessionsResponse.body);

    expect(sessions.total).toBe(2);

    expect(sessions.sessions[0]).toMatchObject({
      id: firstLogin.sessionId,

      isCurrent: true,
    });

    await request(httpServer())
      .delete(`/api/v1/auth/sessions/${secondLogin.sessionId}`)
      .set(
        'Authorization',

        `Bearer ${firstLogin.accessToken}`,
      )
      .expect(204);

    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${secondLogin.accessToken}`,
      )
      .expect(401);

    await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', firstLogin.cookieHeader)
      .set('X-CSRF-Token', firstLogin.csrfToken)
      .expect(204);

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', firstLogin.cookieHeader)
      .set('X-CSRF-Token', firstLogin.csrfToken)
      .expect(401);
  });

  it('rotates refresh and CSRF cookies together', async () => {
    const user = await registerAndVerify('rotation');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'rotation-device',
    );

    const response = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', authenticated.cookieHeader)
      .set('X-CSRF-Token', authenticated.csrfToken)
      .expect(200);

    const rotated = readAuthCookies(response);

    expect(rotated.refreshCookie).not.toBe(authenticated.refreshCookie);

    expect(rotated.csrfToken).not.toBe(authenticated.csrfToken);

    expect(response.headers['x-csrf-token']).toBe(rotated.csrfToken);

    /*
     * CSRF token cÅ© bá»‹ bind vá»›i refresh token cÅ©.
     */
    const oldCsrfResponse = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', rotated.cookieHeader)
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(oldCsrfResponse.status).toBe(403);

    expectErrorCode(
      oldCsrfResponse.body,

      ['AUTH_CSRF_TOKEN_MISMATCH', 'AUTH_CSRF_TOKEN_INVALID'],
    );
  });

  it('requires CSRF header and rejects an untrusted origin', async () => {
    const user = await registerAndVerify('csrf');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'csrf-device',
    );

    const missingHeader = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', authenticated.cookieHeader);

    expect(missingHeader.status).toBe(403);

    expectErrorCode(
      missingHeader.body,

      ['AUTH_CSRF_TOKEN_REQUIRED'],
    );

    const evilOrigin = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Cookie', authenticated.cookieHeader)
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(evilOrigin.status).toBe(403);

    expectErrorCode(
      evilOrigin.body,

      ['AUTH_CSRF_ORIGIN_REJECTED'],
    );

    const evilLogout = await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://evil.example')
      .set('Cookie', authenticated.cookieHeader)
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(evilLogout.status).toBe(403);

    expectErrorCode(
      evilLogout.body,

      ['AUTH_CSRF_ORIGIN_REJECTED'],
    );
  });

  it('changes password, invalidates access tokens and preserves current refresh session', async () => {
    const user = await registerAndVerify('change-password');

    const current = await login(
      user.email,

      defaultPassword,

      'current-device',
    );

    const other = await login(
      user.email,

      defaultPassword,

      'other-device',
    );

    const newPassword = 'NextStrongPass123!';

    const response = await request(httpServer())
      .post('/api/v1/auth/change-password')
      .set(
        'Authorization',

        `Bearer ${current.accessToken}`,
      )
      .send({
        currentPassword: defaultPassword,

        newPassword,
      })
      .expect(200);

    const changePasswordResult = unwrap<{
      passwordChanged: boolean;

      otherSessionsRevoked: number;

      currentSessionKept: boolean;

      accessTokenInvalidated: boolean;

      refreshRequired: boolean;

      changedAt: string;
    }>(response.body);

    expect(changePasswordResult).toMatchObject({
      passwordChanged: true,

      otherSessionsRevoked: 1,

      currentSessionKept: true,

      accessTokenInvalidated: true,

      refreshRequired: true,
    });

    /*
     * changedAt náº±m trong payload Ä‘Ã£ unwrap,
     * khÃ´ng náº±m trá»±c tiáº¿p á»Ÿ response.body.
     */
    expect(changePasswordResult.changedAt).toEqual(expect.any(String));

    /*
     * Kiá»ƒm tra Ä‘Ã¢y lÃ  ISO-8601 timestamp há»£p lá»‡.
     */
    expect(new Date(changePasswordResult.changedAt).toISOString()).toBe(
      changePasswordResult.changedAt,
    );

    /*
     * Controller tráº£ changedAt báº±ng Date.toISOString().
     *
     * KhÃ´ng so sÃ¡nh má»™t timestamp cá»‘ Ä‘á»‹nh vÃ¬ thá»i gian Ä‘Æ°á»£c táº¡o
     * trong lÃºc request thá»±c thi.
     */

    /*
     * Access token hiá»‡n táº¡i Ä‘Ã£ máº¥t hiá»‡u lá»±c.
     */
    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${current.accessToken}`,
      )
      .expect(401);

    /*
     * Access token cá»§a session khÃ¡c cÅ©ng máº¥t hiá»‡u lá»±c.
     */
    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${other.accessToken}`,
      )
      .expect(401);

    /*
     * Current refresh token vÃ  CSRF token váº«n dÃ¹ng
     * Ä‘Æ°á»£c Ä‘á»ƒ láº¥y access token má»›i.
     */
    const refreshResponse = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', current.cookieHeader)
      .set('X-CSRF-Token', current.csrfToken)
      .expect(200);

    const rotated = readAuthCookies(refreshResponse);

    const refreshedAccessToken = unwrap<{
      accessToken: string;
    }>(refreshResponse.body).accessToken;

    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${refreshedAccessToken}`,
      )
      .expect(200);

    /*
     * Session khÃ¡c Ä‘Ã£ revoke nÃªn khÃ´ng refresh Ä‘Æ°á»£c.
     */
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', other.cookieHeader)
      .set('X-CSRF-Token', other.csrfToken)
      .expect(401);

    /*
     * Máº­t kháº©u cÅ© khÃ´ng cÃ²n Ä‘Äƒng nháº­p Ä‘Æ°á»£c.
     */
    await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,
      })
      .expect(401);

    /*
     * Máº­t kháº©u má»›i Ä‘Äƒng nháº­p Ä‘Æ°á»£c.
     */
    await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: newPassword,
      })
      .expect(200);

    /*
     * Cookie rotated váº«n há»£p lá»‡.
     */
    await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', rotated.cookieHeader)
      .set('X-CSRF-Token', rotated.csrfToken)
      .expect(204);
  });

  it('logs out every session for the authenticated user', async () => {
    const user = await registerAndVerify('logout-all');

    const first = await login(
      user.email,

      defaultPassword,

      'logout-all-first',
    );

    const second = await login(
      user.email,

      defaultPassword,

      'logout-all-second',
    );

    await request(httpServer())
      .post('/api/v1/auth/logout-all')
      .set(
        'Authorization',

        `Bearer ${first.accessToken}`,
      )
      .expect(204);

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', first.cookieHeader)
      .set('X-CSRF-Token', first.csrfToken)
      .expect(401);

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', second.cookieHeader)
      .set('X-CSRF-Token', second.csrfToken)
      .expect(401);

    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
      },
    });

    expect(sessions.every(({ revokedAt }) => revokedAt !== null)).toBe(true);

    expect(
      sessions.every(
        ({ revokedReason }) => revokedReason === 'user_logout_all',
      ),
    ).toBe(true);
  });

  it('changes email only after confirmation and revokes every session', async () => {
    const user = await registerAndVerify('change-email');

    const first = await login(
      user.email,

      defaultPassword,

      'email-change-first',
    );

    const second = await login(
      user.email,

      defaultPassword,

      'email-change-second',
    );

    const newEmail = `changed.${runId}@example.test`;

    const requestResponse = await request(httpServer())
      .post('/api/v1/auth/change-email')
      .set(
        'Authorization',

        `Bearer ${first.accessToken}`,
      )
      .set(
        'x-idempotency-key',

        randomUUID(),
      )
      .send({
        currentPassword: defaultPassword,

        newEmail,
      })
      .expect(202);

    expect(unwrap(requestResponse.body)).toMatchObject({
      emailChangeRequested: true,

      pendingEmail: newEmail,

      verificationRequired: true,
    });

    /*
     * Email chÆ°a Ä‘Æ°á»£c Ä‘á»•i trÆ°á»›c confirmation.
     */
    const beforeConfirm = await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${first.accessToken}`,
      )
      .expect(200);

    expect(
      unwrap<{
        email: string;
      }>(beforeConfirm.body).email,
    ).toBe(user.email);

    const changeToken = await readMailToken(
      user.id,

      MailTemplateId.CHANGE_EMAIL,

      'confirmationUrl',
    );

    const confirmation = await request(httpServer())
      .post('/api/v1/auth/change-email/confirm')
      .send({
        token: changeToken,
      })
      .expect(200);

    expect(unwrap(confirmation.body)).toMatchObject({
      emailChanged: true,

      alreadyChanged: false,

      previousEmail: user.email,

      email: newEmail,

      sessionsRevoked: 2,

      reauthenticationRequired: true,
    });

    /*
     * Access tokens cá»§a má»i session máº¥t hiá»‡u lá»±c.
     */
    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${first.accessToken}`,
      )
      .expect(401);

    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${second.accessToken}`,
      )
      .expect(401);

    /*
     * Refresh tokens cÅ©ng máº¥t hiá»‡u lá»±c.
     */
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', first.cookieHeader)
      .set('X-CSRF-Token', first.csrfToken)
      .expect(401);

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', second.cookieHeader)
      .set('X-CSRF-Token', second.csrfToken)
      .expect(401);

    /*
     * Email cÅ© khÃ´ng Ä‘Äƒng nháº­p Ä‘Æ°á»£c.
     */
    await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,
      })
      .expect(401);

    /*
     * Email má»›i Ä‘Äƒng nháº­p Ä‘Æ°á»£c báº±ng cÃ¹ng password.
     */
    const newLogin = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: newEmail,

        password: defaultPassword,

        deviceName: 'after-email-change',
      })
      .expect(200);

    const newAccessToken = unwrap<{
      accessToken: string;
    }>(newLogin.body).accessToken;

    const me = await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${newAccessToken}`,
      )
      .expect(200);

    expect(
      unwrap<{
        email: string;

        emailVerified: boolean;
      }>(me.body),
    ).toMatchObject({
      email: newEmail,

      emailVerified: true,
    });

    /*
     * Token confirmation cÃ³ tÃ­nh idempotent.
     */
    const secondConfirmation = await request(httpServer())
      .post('/api/v1/auth/change-email/confirm')
      .send({
        token: changeToken,
      })
      .expect(200);

    expect(
      unwrap<{
        alreadyChanged: boolean;
      }>(secondConfirmation.body).alreadyChanged,
    ).toBe(true);
  });

  it('returns the same forgot-password response and resets password once', async () => {
    const user = await registerAndVerify('password-reset');

    const firstLogin = await login(
      user.email,

      defaultPassword,

      'password-reset-first',
    );

    const secondLogin = await login(
      user.email,

      defaultPassword,

      'password-reset-second',
    );

    const existingResponse = await request(httpServer())
      .post('/api/v1/auth/forgot-password')
      .send({
        email: user.email,
      })
      .expect(202);

    const missingResponse = await request(httpServer())
      .post('/api/v1/auth/forgot-password')
      .send({
        email: `missing.${runId}@example.test`,
      })
      .expect(202);

    expect(unwrap(existingResponse.body)).toEqual(unwrap(missingResponse.body));

    const resetToken = await readMailToken(
      user.id,

      MailTemplateId.PASSWORD_RESET,

      'resetUrl',
    );

    const newPassword = 'NewStrongPass123!';

    const resetResponse = await request(httpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,

        newPassword,
      })
      .expect(200);

    expect(
      unwrap<{
        passwordReset: boolean;

        sessionsRevoked: number;
      }>(resetResponse.body),
    ).toMatchObject({
      passwordReset: true,

      sessionsRevoked: 2,
    });

    await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,
      })
      .expect(401);

    await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: newPassword,
      })
      .expect(200);

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', firstLogin.cookieHeader)
      .set('X-CSRF-Token', firstLogin.csrfToken)
      .expect(401);

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', secondLogin.cookieHeader)
      .set('X-CSRF-Token', secondLogin.csrfToken)
      .expect(401);

    const secondReset = await request(httpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,

        newPassword: 'AnotherPass123!',
      });

    expect(secondReset.status).toBe(401);

    expectErrorCode(
      secondReset.body,

      ['AUTH_PASSWORD_RESET_TOKEN_INVALID'],
    );
  });

  it('enforces login rate limit and returns retry metadata', async () => {
    const identifier = `rate-limit.${runId}@example.test`;

    const responses: request.Response[] = [];

    for (let index = 0; index < 3; index += 1) {
      responses.push(
        await request(httpServer()).post('/api/v1/auth/login').send({
          identifier,

          password: 'WrongPass123!',
        }),
      );
    }

    expect(responses[0]?.status).toBe(401);

    expect(responses[1]?.status).toBe(401);

    expect(responses[2]?.status).toBe(429);

    expectErrorCode(
      responses[2]?.body,

      ['AUTH_LOGIN_RATE_LIMIT_EXCEEDED'],
    );

    const body = responses[2]?.body as {
      error?: {
        details?: {
          retryAfterSeconds?: number;

          scope?: string;
        };
      };
    };

    expect(body.error?.details?.retryAfterSeconds).toBeGreaterThan(0);

    expect(body.error?.details?.scope).toBe('identifier');
  });

  it('returns sanitized security events for the current user', async () => {
    const user = await registerAndVerify('security-events');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'security-events-device',
    );

    const response = await request(httpServer())
      .get('/api/v1/auth/security-events?limit=20')
      .set(
        'Authorization',

        `Bearer ${authenticated.accessToken}`,
      )
      .expect(200);

    const result = unwrap<{
      total: number;

      events: Array<{
        action: string;

        entityType: string;

        entityId: string | null;

        metadata: Record<string, unknown> | null;

        createdAt: string;
      }>;
    }>(response.body);

    expect(result.total).toBeGreaterThanOrEqual(1);

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'auth.login.succeeded',

          entityType: 'session',

          entityId: authenticated.sessionId,
        }),
      ]),
    );

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(defaultPassword);

    expect(serialized).not.toContain(authenticated.accessToken);

    expect(serialized).not.toContain(authenticated.refreshCookie);
  });

  it('rejects duplicate and malformed authentication cookies', async () => {
    const user = await registerAndVerify('cookie-ambiguity');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'cookie-ambiguity-device',
    );

    /*
     * Duplicate refresh cookie khÃ´ng Ä‘Æ°á»£c láº¥y token Ä‘áº§u tiÃªn
     * hoáº·c token cuá»‘i cÃ¹ng.
     */
    const duplicateRefreshResponse = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set(
        'Cookie',

        [
          authenticated.refreshCookie,
          'refresh_token=attacker-controlled-value',
          authenticated.csrfCookie,
        ].join('; '),
      )
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(duplicateRefreshResponse.status).toBe(401);

    expectErrorCode(
      duplicateRefreshResponse.body,

      ['AUTH_INVALID_REFRESH_TOKEN'],
    );

    /*
     * Percent encoding khÃ´ng há»£p lá»‡ pháº£i bá»‹ reject,
     * khÃ´ng Ä‘Æ°á»£c xem nhÆ° cookie bá»‹ thiáº¿u.
     */
    const malformedRefreshResponse = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set(
        'Cookie',

        ['refresh_token=%E0%A4%A', authenticated.csrfCookie].join('; '),
      )
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(malformedRefreshResponse.status).toBe(401);

    expectErrorCode(
      malformedRefreshResponse.body,

      ['AUTH_INVALID_REFRESH_TOKEN'],
    );

    /*
     * Logout khÃ´ng cÃ³ cookie váº«n idempotent, nhÆ°ng logout
     * cÃ³ duplicate credential cookie pháº£i bá»‹ tá»« chá»‘i.
     */
    const duplicateLogoutResponse = await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set(
        'Cookie',

        [
          authenticated.refreshCookie,
          'refresh_token=attacker-controlled-value',
          authenticated.csrfCookie,
        ].join('; '),
      )
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(duplicateLogoutResponse.status).toBe(401);

    expectErrorCode(
      duplicateLogoutResponse.body,

      ['AUTH_INVALID_REFRESH_TOKEN'],
    );

    /*
     * CSRF cookie duplicate cÅ©ng khÃ´ng Ä‘Æ°á»£c tá»± chá»n.
     */
    const duplicateCsrfResponse = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set(
        'Cookie',

        [
          authenticated.refreshCookie,
          authenticated.csrfCookie,
          'csrf_token=attacker-controlled-value',
        ].join('; '),
      )
      .set('X-CSRF-Token', authenticated.csrfToken);

    expect(duplicateCsrfResponse.status).toBe(403);

    expectErrorCode(
      duplicateCsrfResponse.body,

      ['AUTH_CSRF_TOKEN_MALFORMED'],
    );

    /*
     * CÃ¡c request lá»—i phÃ­a trÃªn khÃ´ng Ä‘Æ°á»£c revoke session
     * hoáº·c tiÃªu thá»¥ refresh token há»£p lá»‡.
     */
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', authenticated.cookieHeader)
      .set('X-CSRF-Token', authenticated.csrfToken)
      .expect(200);
  });

  it('allows one concurrent refresh, detects reuse and revokes the family', async () => {
    const user = await registerAndVerify('refresh-concurrency');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'concurrency-device',
    );

    const sendRefresh = () =>
      request(httpServer())
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', authenticated.cookieHeader)
        .set('X-CSRF-Token', authenticated.csrfToken);

    const responses = await Promise.all([sendRefresh(), sendRefresh()]);

    expect(
      responses.map(({ status }) => status).sort((left, right) => left - right),
    ).toEqual([200, 401]);

    const rejected = responses.find(({ status }) => status === 401);

    expectErrorCode(
      rejected?.body,

      ['AUTH_REFRESH_TOKEN_REUSE_DETECTED', 'AUTH_INVALID_REFRESH_TOKEN'],
    );

    const successful = responses.find(({ status }) => status === 200);

    if (!successful) {
      throw new Error('Expected one successful refresh response');
    }

    const rotated = readAuthCookies(successful);

    /*
     * Loser request Ä‘Ã£ revoke cáº£ family.
     * Refresh token vá»«a Ä‘Æ°á»£c winner tráº£ vá» cÅ©ng máº¥t hiá»‡u lá»±c.
     */
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', rotated.cookieHeader)
      .set('X-CSRF-Token', rotated.csrfToken)
      .expect(401);

    const session = await prisma.session.findUniqueOrThrow({
      where: {
        id: authenticated.sessionId,
      },
    });

    expect(session.revokedAt).not.toBeNull();

    expect(session.revokedReason).toBe('refresh_token_reuse_detected');
  });

  async function registerAndVerify(name: string): Promise<{
    id: string;

    email: string;

    username: string;
  }> {
    const email = `${sanitize(name)}.${runId}@example.test`;

    const username = `${sanitize(name)}_${runId.replaceAll('-', '').slice(0, 12)}`;

    const registerResponse = await request(httpServer())
      .post('/api/v1/auth/register')
      .set('x-idempotency-key', randomUUID())
      .send({
        email,

        username,

        password: defaultPassword,

        displayName: `Reader ${name}`,
      })
      .expect(201);

    const registered = unwrap<{
      id: string;

      email: string;

      username: string;

      verificationRequired: boolean;
    }>(registerResponse.body);

    expect(registered.verificationRequired).toBe(true);

    const verificationToken = await readMailToken(
      registered.id,

      MailTemplateId.EMAIL_VERIFICATION,

      'verificationUrl',
    );

    const verifyResponse = await request(httpServer())
      .post('/api/v1/auth/verify-email')
      .send({
        token: verificationToken,
      })
      .expect(200);

    expect(
      unwrap<{
        emailVerified: boolean;
      }>(verifyResponse.body).emailVerified,
    ).toBe(true);

    return {
      id: registered.id,

      email: registered.email,

      username: registered.username,
    };
  }

  async function login(
    identifier: string,

    password: string,

    deviceName: string,
  ) {
    const response = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier,

        password,

        deviceId: randomUUID(),

        deviceName,
      })
      .expect(200);

    const result = unwrap<{
      sessionId: string;

      accessToken: string;
    }>(response.body);

    return {
      ...result,

      ...readAuthCookies(response),
    };
  }

  async function readMailToken(
    userId: string,

    templateId: MailTemplateId,

    variableName: 'verificationUrl' | 'resetUrl' | 'confirmationUrl',
  ): Promise<string> {
    const events = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: userId,

        aggregateType: 'mail',

        eventType: SEND_MAIL_JOB,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    for (const event of events) {
      if (!isEncryptedMailPayloadV1(event.payload)) {
        continue;
      }

      const decrypted = cipher.decrypt(event.payload);

      if (
        !decrypted ||
        typeof decrypted !== 'object' ||
        Array.isArray(decrypted)
      ) {
        continue;
      }

      const payload = decrypted as SendMailJobV1;

      if (payload.templateId !== (templateId as string)) {
        continue;
      }

      const rawUrl = payload.variables[variableName];

      if (typeof rawUrl !== 'string') {
        continue;
      }

      const token = new URL(rawUrl).searchParams.get('token');

      if (token) {
        return token;
      }
    }

    throw new Error(`Mail token not found for template ${templateId}`);
  }

  function readAuthCookies(response: { headers: Record<string, unknown> }) {
    const setCookies = readSetCookieHeaders(response.headers['set-cookie']);

    const refreshSetCookie = findSetCookie(
      setCookies,

      'refresh_token',
    );

    const csrfSetCookie = findSetCookie(
      setCookies,

      'csrf_token',
    );

    const refreshCookie = cookiePair(refreshSetCookie);

    const csrfCookie = cookiePair(csrfSetCookie);

    const csrfToken = decodeURIComponent(
      csrfCookie.slice(csrfCookie.indexOf('=') + 1),
    );

    return {
      refreshSetCookie,

      csrfSetCookie,

      refreshCookie,

      csrfCookie,

      csrfToken,

      cookieHeader: `${refreshCookie}; ${csrfCookie}`,
    };
  }

  function readSetCookieHeaders(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
      return [value];
    }

    throw new Error('Set-Cookie response header is missing');
  }

  function findSetCookie(
    values: readonly string[],

    name: string,
  ): string {
    const found = values.find((value) => value.startsWith(`${name}=`));

    if (!found) {
      throw new Error(`Cookie ${name} was not set`);
    }

    return found;
  }

  function cookiePair(setCookie: string): string {
    return setCookie.split(';').at(0) ?? setCookie;
  }

  function unwrap<T>(body: unknown): T {
    if (body && typeof body === 'object' && 'data' in body) {
      return (
        body as {
          data: T;
        }
      ).data;
    }

    return body as T;
  }

  function expectErrorCode(
    body: unknown,

    expectedCodes: readonly string[],
  ): void {
    const code =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      (
        body as {
          error?: {
            code?: unknown;
          };
        }
      ).error &&
      typeof (
        body as {
          error: {
            code?: unknown;
          };
        }
      ).error.code === 'string'
        ? (
            body as {
              error: {
                code: string;
              };
            }
          ).error.code
        : undefined;

    expect(expectedCodes).toContain(code);
  }

  async function cleanupRun() {
    if (!prisma) {
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: runId,
        },
      },

      select: {
        id: true,
      },
    });

    const userIds = users.map(({ id }) => id);

    if (userIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateId: {
            in: userIds,
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

    await prisma.outboxEvent.deleteMany({
      where: {
        idempotencyKey: {
          contains: runId,
        },
      },
    });
  }

  function httpServer() {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  function sanitize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/gu, '_');
  }

  function requireEnvironment(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  }
});
