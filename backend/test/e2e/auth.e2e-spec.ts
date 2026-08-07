import { createHmac, randomUUID } from 'node:crypto';

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

import { OAuthHandoffStore } from '@/modules/auth/infrastructure';

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

  let oauthHandoffs: OAuthHandoffStore;

  const createdUserIds = new Set<string>();

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

    oauthHandoffs = app.get(OAuthHandoffStore);

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

    await prisma.role.upsert({
      where: {
        code: RoleCode.ADMIN,
      },

      update: {},

      create: {
        code: RoleCode.ADMIN,

        name: 'Admin',

        description: 'E2E administrator role',

        isSystem: true,
      },
    });

    for (const [index, label] of [
      'E2E: Biệt danh thời thơ ấu của bạn là gì?',
      'E2E: Tên người bạn thân đầu tiên của bạn là gì?',
      'E2E: Thành phố đầu tiên bạn từng sống là gì?',
    ].entries()) {
      await prisma.securityQuestion.upsert({
        where: {
          code: `e2e_auth_question_${index + 1}`,
        },

        update: {
          label,

          locale: 'vi',

          isActive: true,

          sortOrder: index + 1,
        },

        create: {
          code: `e2e_auth_question_${index + 1}`,

          label,

          locale: 'vi',

          isActive: true,

          sortOrder: index + 1,
        },
      });
    }
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
     * changedAt nằm trong payload đã unwrap,
     * không nằm trực tiếp ở response.body.
     */
    expect(changePasswordResult.changedAt).toEqual(expect.any(String));

    /*
     * Kiểm tra đây là ISO-8601 timestamp hợp lệ.
     */
    expect(new Date(changePasswordResult.changedAt).toISOString()).toBe(
      changePasswordResult.changedAt,
    );

    /*
     * Controller trả changedAt bằng Date.toISOString().
     *
     * Không so sánh một timestamp cố định vì thời gian được tạo
     * trong lúc request thực thi.
     */

    /*
     * Access token hiện tại đã mất hiệu lực.
     */
    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${current.accessToken}`,
      )
      .expect(401);

    /*
     * Access token của session khác cũng mất hiệu lực.
     */
    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${other.accessToken}`,
      )
      .expect(401);

    /*
     * Current refresh token và CSRF token vẫn dùng
     * được để lấy access token mới.
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

  it('validates password reset tokens without consuming them and rejects expired or consumed tokens', async () => {
    const user = await registerAndVerify('reset-token-validation');

    await request(httpServer())
      .post('/api/v1/auth/forgot-password')
      .send({
        email: user.email,
      })
      .expect(202);

    const resetToken = await readMailToken(
      user.id,

      MailTemplateId.PASSWORD_RESET,

      'resetUrl',
    );

    const validResponse = await request(httpServer())
      .post('/api/v1/auth/reset-password/validate')
      .send({
        token: resetToken,
      })
      .expect(200);

    const valid = unwrap<{
      valid: true;

      expiresAt: string;
    }>(validResponse.body);

    expect(valid.valid).toBe(true);

    expect(new Date(valid.expiresAt).toISOString()).toBe(valid.expiresAt);

    const tokenRecord = await prisma.userToken.findFirstOrThrow({
      where: {
        userId: user.id,

        type: 'PASSWORD_RESET',

        consumedAt: null,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(tokenRecord.consumedAt).toBeNull();

    await prisma.userToken.update({
      where: {
        id: tokenRecord.id,
      },

      data: {
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const expiredResponse = await request(httpServer())
      .post('/api/v1/auth/reset-password/validate')
      .send({
        token: resetToken,
      });

    expect(expiredResponse.status).toBe(410);

    expectErrorCode(expiredResponse.body, [
      'AUTH_PASSWORD_RESET_TOKEN_EXPIRED',
    ]);

    await prisma.userToken.update({
      where: {
        id: tokenRecord.id,
      },

      data: {
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await request(httpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,

        newPassword: 'ResetValidation123!',
      })
      .expect(200);

    const consumedResponse = await request(httpServer())
      .post('/api/v1/auth/reset-password/validate')
      .send({
        token: resetToken,
      });

    expect(consumedResponse.status).toBe(401);

    expectErrorCode(consumedResponse.body, [
      'AUTH_PASSWORD_RESET_TOKEN_INVALID',
    ]);
  });

  it('returns the authenticated security overview contract', async () => {
    const user = await registerAndVerify('security-overview');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'security-overview-device',
    );

    const response = await request(httpServer())
      .get('/api/v1/auth/security-overview')
      .set(
        'Authorization',

        `Bearer ${authenticated.accessToken}`,
      )
      .expect(200);

    const overview = unwrap<{
      passwordConfigured: boolean;

      passwordUpdatedAt: string | null;

      mfaEnabled: boolean;

      mfaConfiguredAt: string | null;

      recoveryEmail: string | null;

      recoveryEmailVerified: boolean;

      securityQuestionsConfigured: boolean;

      trustedDeviceCount: number;
    }>(response.body);

    expect(overview.passwordConfigured).toBe(true);

    expect(
      overview.passwordUpdatedAt === null ||
        typeof overview.passwordUpdatedAt === 'string',
    ).toBe(true);

    expect(overview).toMatchObject({
      mfaEnabled: false,

      mfaConfiguredAt: null,

      recoveryEmail: null,

      recoveryEmailVerified: false,

      securityQuestionsConfigured: false,

      trustedDeviceCount: 0,
    });
  });

  it('soft deletes and anonymizes an account while revoking every authentication session', async () => {
    const user = await registerAndVerify('delete-account');

    const first = await login(
      user.email,

      defaultPassword,

      'delete-account-first',
    );

    const second = await login(
      user.email,

      defaultPassword,

      'delete-account-second',
    );

    const wrongPasswordResponse = await request(httpServer())
      .delete('/api/v1/auth/account')
      .set(
        'Authorization',

        `Bearer ${first.accessToken}`,
      )
      .set('x-idempotency-key', randomUUID())
      .send({
        password: 'WrongPassword123!',

        confirmation: 'XOA TAI KHOAN',
      });

    expect(wrongPasswordResponse.status).toBe(403);

    expectErrorCode(wrongPasswordResponse.body, [
      'AUTH_CURRENT_PASSWORD_INVALID',
    ]);

    await request(httpServer())
      .delete('/api/v1/auth/account')
      .set(
        'Authorization',

        `Bearer ${first.accessToken}`,
      )
      .set('x-idempotency-key', randomUUID())
      .send({
        password: defaultPassword,

        confirmation: 'XOA TAI KHOAN',
      })
      .expect(204);

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

    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', first.cookieHeader)
      .set('X-CSRF-Token', first.csrfToken)
      .expect(401);

    const deleted = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(deleted.status).toBe('DELETED');

    expect(deleted.deletedAt).not.toBeNull();

    expect(deleted.passwordHash).toBeNull();

    expect(deleted.email).toMatch(/^deleted\+[a-f0-9]+@deleted\.invalid$/u);

    expect(deleted.username).toMatch(/^deleted_[a-f0-9]+$/u);

    expect(deleted.displayName).toBe('Người dùng đã xóa');

    expect(
      await prisma.userRole.count({
        where: {
          userId: user.id,
        },
      }),
    ).toBe(0);

    expect(
      await prisma.userToken.count({
        where: {
          userId: user.id,
        },
      }),
    ).toBe(0);

    const deletionRequest =
      await prisma.accountDeletionRequest.findFirstOrThrow({
        where: {
          userId: user.id,
        },

        orderBy: {
          requestedAt: 'desc',
        },
      });

    expect(deletionRequest.status).toBe('COMPLETED');

    expect(deletionRequest.completedAt).not.toBeNull();

    await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,
      })
      .expect(401);
  });

  it('allows a normal user to enable MFA and later authenticate with TOTP or a one-time recovery code', async () => {
    const user = await registerAndVerify('user-mfa');

    const current = await login(
      user.email,

      defaultPassword,

      'mfa-current',
    );

    const oldSession = await login(
      user.email,

      defaultPassword,

      'mfa-old-session',
    );

    const beginResponse = await request(httpServer())
      .post('/api/v1/auth/security/mfa/enrollment')
      .set(
        'Authorization',

        `Bearer ${current.accessToken}`,
      )
      .set('x-idempotency-key', randomUUID())
      .send({
        currentPassword: defaultPassword,
      })
      .expect(200);

    const enrollment = unwrap<{
      enrollmentId: string;

      secret: string;

      otpAuthUri: string;

      expiresAt: string;
    }>(beginResponse.body);

    expect(enrollment.otpAuthUri).toContain('otpauth://totp/');

    const confirmResponse = await request(httpServer())
      .post('/api/v1/auth/security/mfa/enrollment/confirm')
      .set(
        'Authorization',

        `Bearer ${current.accessToken}`,
      )
      .set('x-idempotency-key', randomUUID())
      .send({
        enrollmentId: enrollment.enrollmentId,

        totpCode: generateTotpCode(enrollment.secret),

        deviceName: 'MFA E2E device',
      })
      .expect(200);

    const confirmed = unwrap<{
      status: {
        enabled: boolean;

        recoveryCodesRemaining: number;
      };

      recoveryCodes: string[];
    }>(confirmResponse.body);

    expect(confirmed.status.enabled).toBe(true);

    expect(confirmed.recoveryCodes.length).toBeGreaterThan(0);

    expect(confirmed.status.recoveryCodesRemaining).toBe(
      confirmed.recoveryCodes.length,
    );

    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${oldSession.accessToken}`,
      )
      .expect(401);

    const statusResponse = await request(httpServer())
      .get('/api/v1/auth/security/mfa')
      .set(
        'Authorization',

        `Bearer ${current.accessToken}`,
      )
      .expect(200);

    expect(
      unwrap<{
        enabled: boolean;
      }>(statusResponse.body).enabled,
    ).toBe(true);

    await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', current.cookieHeader)
      .set('X-CSRF-Token', current.csrfToken)
      .expect(204);

    const loginChallengeResponse = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,

        deviceName: 'mfa-login',
      });

    expect(loginChallengeResponse.status).toBe(412);

    expectErrorCode(loginChallengeResponse.body, ['AUTH_MFA_REQUIRED']);

    const challenge = readMfaChallenge(loginChallengeResponse.body);

    expect(challenge.mode).toBe('verify');

    const verifyResponse = await request(httpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        mfaTicket: challenge.mfaTicket,

        totpCode: generateTotpCode(enrollment.secret, 1),

        deviceName: 'mfa-login',
      })
      .expect(200);

    const verified = unwrap<{
      accessToken: string;
    }>(verifyResponse.body);

    await request(httpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',

        `Bearer ${verified.accessToken}`,
      )
      .expect(200);

    const verifiedCookies = readAuthCookies(verifyResponse);

    await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', verifiedCookies.cookieHeader)
      .set('X-CSRF-Token', verifiedCookies.csrfToken)
      .expect(204);

    const recoveryChallengeResponse = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,
      });

    expect(recoveryChallengeResponse.status).toBe(412);

    const recoveryChallenge = readMfaChallenge(recoveryChallengeResponse.body);

    const recoveryCode = confirmed.recoveryCodes[0];

    if (!recoveryCode) {
      throw new Error('Expected at least one MFA recovery code');
    }

    const recoveryLogin = await request(httpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        mfaTicket: recoveryChallenge.mfaTicket,

        recoveryCode,
      })
      .expect(200);

    const recoveryCookies = readAuthCookies(recoveryLogin);

    await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', recoveryCookies.cookieHeader)
      .set('X-CSRF-Token', recoveryCookies.csrfToken)
      .expect(204);

    const reuseChallengeResponse = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,
      });

    expect(reuseChallengeResponse.status).toBe(412);

    const reuseChallenge = readMfaChallenge(reuseChallengeResponse.body);

    const reusedRecoveryCodeResponse = await request(httpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        mfaTicket: reuseChallenge.mfaTicket,

        recoveryCode,
      });

    expect(reusedRecoveryCodeResponse.status).toBe(401);

    expectErrorCode(reusedRecoveryCodeResponse.body, ['AUTH_MFA_CODE_INVALID']);
  });

  it('forces an admin to enroll MFA before login and prevents disabling policy-required MFA', async () => {
    const user = await registerAndVerify('admin-mfa-policy');

    await grantRole(user.id, RoleCode.ADMIN);

    const loginResponse = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,

        password: defaultPassword,

        deviceName: 'admin-policy',
      });

    expect(loginResponse.status).toBe(412);

    expectErrorCode(loginResponse.body, ['AUTH_MFA_ENROLLMENT_REQUIRED']);

    const challenge = readMfaChallenge(loginResponse.body);

    expect(challenge.mode).toBe('enroll');

    const beginResponse = await request(httpServer())
      .post('/api/v1/auth/mfa/enrollment')
      .send({
        mfaTicket: challenge.mfaTicket,
      })
      .expect(200);

    const enrollment = unwrap<{
      secret: string;

      otpAuthUri: string;
    }>(beginResponse.body);

    expect(enrollment.otpAuthUri).toContain('otpauth://totp/');

    const confirmResponse = await request(httpServer())
      .post('/api/v1/auth/mfa/enrollment/confirm')
      .send({
        mfaTicket: challenge.mfaTicket,

        totpCode: generateTotpCode(enrollment.secret),

        deviceName: 'admin-policy',
      })
      .expect(200);

    const authenticated = unwrap<{
      accessToken: string;
    }>(confirmResponse.body);

    const disableResponse = await request(httpServer())
      .delete('/api/v1/auth/security/mfa')
      .set(
        'Authorization',

        `Bearer ${authenticated.accessToken}`,
      )
      .set('x-idempotency-key', randomUUID())
      .send({
        currentPassword: defaultPassword,

        totpCode: generateTotpCode(enrollment.secret, 1),
      });

    expect(disableResponse.status).toBe(403);

    expectErrorCode(disableResponse.body, ['AUTH_MFA_REQUIRED_BY_POLICY']);

    const credential = await prisma.mfaCredential.findFirst({
      where: {
        userId: user.id,

        status: 'ENABLED',
      },
    });

    expect(credential).not.toBeNull();
  });

  it('requests verifies and removes a recovery email with cooldown and wrong-code protection', async () => {
    const user = await registerAndVerify('recovery-email');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'recovery-email-device',
    );

    const authorization = `Bearer ${authenticated.accessToken}`;

    const initialResponse = await request(httpServer())
      .get('/api/v1/auth/security/recovery-email')
      .set('Authorization', authorization)
      .expect(200);

    expect(unwrap(initialResponse.body)).toMatchObject({
      email: null,

      verified: false,

      pendingEmail: null,
    });

    const recoveryEmail = `backup.${runId}@example.test`;

    const requestedResponse = await request(httpServer())
      .post('/api/v1/auth/security/recovery-email/request')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        email: recoveryEmail,

        currentPassword: defaultPassword,
      })
      .expect(200);

    expect(unwrap(requestedResponse.body)).toMatchObject({
      email: null,

      verified: false,

      pendingEmail: recoveryEmail,
    });

    const tooSoonResponse = await request(httpServer())
      .post('/api/v1/auth/security/recovery-email/resend')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({});

    expect(tooSoonResponse.status).toBe(429);

    expectErrorCode(tooSoonResponse.body, [
      'AUTH_RECOVERY_EMAIL_RESEND_TOO_SOON',
    ]);

    const verificationCode = await readMailStringVariable(
      user.id,

      MailTemplateId.RECOVERY_EMAIL_CODE,

      'code',
    );

    const wrongCodeResponse = await request(httpServer())
      .post('/api/v1/auth/security/recovery-email/verify')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        code: differentNumericCode(verificationCode),
      });

    expect(wrongCodeResponse.status).toBe(401);

    expectErrorCode(wrongCodeResponse.body, [
      'AUTH_RECOVERY_EMAIL_CODE_INVALID',
    ]);

    const verifiedResponse = await request(httpServer())
      .post('/api/v1/auth/security/recovery-email/verify')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        code: verificationCode,
      })
      .expect(200);

    expect(unwrap(verifiedResponse.body)).toMatchObject({
      email: recoveryEmail,

      verified: true,

      pendingEmail: null,
    });

    const overviewResponse = await request(httpServer())
      .get('/api/v1/auth/security-overview')
      .set('Authorization', authorization)
      .expect(200);

    expect(
      unwrap<{
        recoveryEmail: string | null;

        recoveryEmailVerified: boolean;
      }>(overviewResponse.body),
    ).toMatchObject({
      recoveryEmail,

      recoveryEmailVerified: true,
    });

    const removedResponse = await request(httpServer())
      .delete('/api/v1/auth/security/recovery-email')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        currentPassword: defaultPassword,
      })
      .expect(200);

    expect(unwrap(removedResponse.body)).toEqual({
      email: null,

      verified: false,

      verifiedAt: null,

      pendingEmail: null,

      pendingExpiresAt: null,
    });

    expect(
      await prisma.recoveryEmail.findUnique({
        where: {
          userId: user.id,
        },
      }),
    ).toBeNull();
  });

  it('configures exactly three security questions without exposing plaintext answers', async () => {
    const user = await registerAndVerify('security-questions');

    const authenticated = await login(
      user.email,

      defaultPassword,

      'security-questions-device',
    );

    const authorization = `Bearer ${authenticated.accessToken}`;

    const catalogResponse = await request(httpServer())
      .get('/api/v1/auth/security/questions/catalog')
      .set('Authorization', authorization)
      .expect(200);

    const catalog = unwrap<
      Array<{
        id: string;

        label: string;
      }>
    >(catalogResponse.body).filter(({ label }) => label.startsWith('E2E:'));

    expect(catalog).toHaveLength(3);

    const [first, second, third] = catalog;

    if (!first || !second || !third) {
      throw new Error('Expected three E2E security questions');
    }

    const initialResponse = await request(httpServer())
      .get('/api/v1/auth/security/questions')
      .set('Authorization', authorization)
      .expect(200);

    expect(
      unwrap<{
        configured: boolean;
      }>(initialResponse.body).configured,
    ).toBe(false);

    const answers = [
      {
        questionId: first.id,

        answer: 'Alpha secret answer',
      },

      {
        questionId: second.id,

        answer: 'Beta secret answer',
      },

      {
        questionId: third.id,

        answer: 'Gamma secret answer',
      },
    ];

    const updatedResponse = await request(httpServer())
      .put('/api/v1/auth/security/questions')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        currentPassword: defaultPassword,

        answers,
      })
      .expect(200);

    const updated = unwrap<{
      configured: boolean;

      questions: Array<{
        questionId: string;
      }>;
    }>(updatedResponse.body);

    expect(updated.configured).toBe(true);

    expect(updated.questions).toHaveLength(3);

    const databaseAnswers = await prisma.userSecurityQuestion.findMany({
      where: {
        userId: user.id,
      },

      orderBy: {
        position: 'asc',
      },
    });

    expect(databaseAnswers).toHaveLength(3);

    for (const row of databaseAnswers) {
      expect(row.answerHash).toMatch(/^\$2[aby]\$/u);

      expect(answers.some(({ answer }) => row.answerHash === answer)).toBe(
        false,
      );
    }

    const serialized = JSON.stringify(updatedResponse.body);

    expect(serialized).not.toContain('Alpha secret answer');

    expect(serialized).not.toContain('answerHash');

    const overviewResponse = await request(httpServer())
      .get('/api/v1/auth/security-overview')
      .set('Authorization', authorization)
      .expect(200);

    expect(
      unwrap<{
        securityQuestionsConfigured: boolean;
      }>(overviewResponse.body).securityQuestionsConfigured,
    ).toBe(true);

    const duplicateQuestionResponse = await request(httpServer())
      .put('/api/v1/auth/security/questions')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        currentPassword: defaultPassword,

        answers: [
          {
            questionId: first.id,

            answer: 'One answer',
          },

          {
            questionId: first.id,

            answer: 'Another answer',
          },

          {
            questionId: third.id,

            answer: 'Third answer',
          },
        ],
      });

    expect(duplicateQuestionResponse.status).toBe(400);

    expectErrorCode(duplicateQuestionResponse.body, [
      'AUTH_SECURITY_QUESTION_INVALID',
    ]);

    const removedResponse = await request(httpServer())
      .delete('/api/v1/auth/security/questions')
      .set('Authorization', authorization)
      .set('x-idempotency-key', randomUUID())
      .send({
        currentPassword: defaultPassword,
      })
      .expect(200);

    expect(
      unwrap<{
        configured: boolean;

        questions: unknown[];
      }>(removedResponse.body),
    ).toMatchObject({
      configured: false,

      questions: [],
    });

    expect(
      await prisma.userSecurityQuestion.count({
        where: {
          userId: user.id,
        },
      }),
    ).toBe(0);
  });

  it('starts Google OAuth with PKCE state and an HttpOnly state cookie', async () => {
    const response = await request(httpServer())
      .get('/api/v1/auth/oauth/google')
      .redirects(0)
      .expect(302);

    const location = response.headers.location;

    expect(typeof location).toBe('string');

    expect(location).toMatch(
      /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/u,
    );

    const url = new URL(location);

    expect(url.searchParams.get('client_id')).toBe('qlt-e2e-google-client');

    expect(url.searchParams.get('response_type')).toBe('code');

    expect(url.searchParams.get('code_challenge_method')).toBe('S256');

    expect(url.searchParams.get('state')).toEqual(expect.any(String));

    expect(url.searchParams.get('nonce')).toEqual(expect.any(String));

    const cookies = readSetCookieHeaders(response.headers['set-cookie']);

    const oauthCookie = findSetCookie(cookies, 'oauth_state');

    expect(oauthCookie).toContain('HttpOnly');

    expect(oauthCookie).toContain('Path=/api/v1/auth/oauth');

    expect(oauthCookie.toLowerCase()).toContain('samesite=lax');
  });

  it('consumes an OAuth handoff exactly once', async () => {
    const mfaTicket = randomUUID();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const handoff = await oauthHandoffs.issue({
      status: 'mfa',

      challenge: {
        mfaTicket,

        mode: 'verify',

        expiresAt,
      },
    });

    expect(handoff).not.toContain(mfaTicket);

    const firstResponse = await request(httpServer())
      .post('/api/v1/auth/oauth/finalize')
      .send({
        handoff,
      })
      .expect(200);

    expect(unwrap(firstResponse.body)).toEqual({
      status: 'mfa',

      challenge: {
        mfaTicket,

        mode: 'verify',

        expiresAt,
      },
    });

    const secondResponse = await request(httpServer())
      .post('/api/v1/auth/oauth/finalize')
      .send({
        handoff,
      });

    expect(secondResponse.status).toBe(400);

    expectErrorCode(secondResponse.body, ['AUTH_OAUTH_FLOW_INVALID']);
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

    createdUserIds.add(registered.id);

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

  async function readMailStringVariable(
    userId: string,

    templateId: MailTemplateId,

    variableName: string,
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

      const value = payload.variables[variableName];

      if (typeof value === 'string') {
        return value;
      }
    }

    throw new Error(
      `Mail variable ${variableName} not found for template ${templateId}`,
    );
  }

  async function readMailToken(
    userId: string,

    templateId: MailTemplateId,

    variableName: 'verificationUrl' | 'resetUrl' | 'confirmationUrl',
  ): Promise<string> {
    const rawUrl = await readMailStringVariable(
      userId,

      templateId,

      variableName,
    );

    const token = new URL(rawUrl).searchParams.get('token');

    if (!token) {
      throw new Error(`Mail token not found for template ${templateId}`);
    }

    return token;
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

    const trackedIds = [...createdUserIds];

    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            email: {
              contains: runId,
            },
          },

          ...(trackedIds.length > 0
            ? [
                {
                  id: {
                    in: trackedIds,
                  },
                },
              ]
            : []),
        ],
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

    createdUserIds.clear();
  }

  async function grantRole(
    userId: string,

    roleCode: RoleCode,
  ): Promise<void> {
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        code: roleCode,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,

          roleId: role.id,
        },
      },

      update: {},

      create: {
        userId,

        roleId: role.id,
      },
    });
  }

  function readMfaChallenge(body: unknown): {
    mfaTicket: string;

    mode: 'enroll' | 'verify';

    expiresAt: string;
  } {
    if (!body || typeof body !== 'object' || !('error' in body)) {
      throw new Error('MFA error envelope is missing');
    }

    const details = (
      body as {
        error?: {
          details?: {
            mfaTicket?: unknown;

            mode?: unknown;

            expiresAt?: unknown;
          };
        };
      }
    ).error?.details;

    if (
      typeof details?.mfaTicket !== 'string' ||
      (details.mode !== 'enroll' && details.mode !== 'verify') ||
      typeof details.expiresAt !== 'string'
    ) {
      throw new Error('Invalid MFA challenge details');
    }

    return {
      mfaTicket: details.mfaTicket,

      mode: details.mode,

      expiresAt: details.expiresAt,
    };
  }

  function differentNumericCode(actual: string): string {
    return actual === '000000' ? '000001' : '000000';
  }

  const testTotpPeriodSeconds = 30;

  const testTotpDigits = 6;

  const testBase32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function generateTotpCode(secret: string, stepOffset = 0): string {
    const key = decodeTestBase32(secret);

    const currentStep = Math.floor(Date.now() / 1000 / testTotpPeriodSeconds);

    const counter = BigInt(currentStep + stepOffset);

    const buffer = Buffer.alloc(8);

    buffer.writeBigUInt64BE(counter);

    const digest = createHmac('sha1', key).update(buffer).digest();

    const offset = digest[digest.length - 1] & 0x0f;

    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return String(binary % 10 ** testTotpDigits).padStart(
      testTotpDigits,

      '0',
    );
  }

  function decodeTestBase32(input: string): Buffer {
    const normalized = input.toUpperCase().replace(/=+$/u, '');

    let bits = 0;

    let value = 0;

    const bytes: number[] = [];

    for (const character of normalized) {
      const index = testBase32Alphabet.indexOf(character);

      if (index < 0) {
        throw new Error('Invalid base32 MFA secret');
      }

      value = (value << 5) | index;

      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);

        bits -= 8;
      }
    }

    return Buffer.from(bytes);
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
