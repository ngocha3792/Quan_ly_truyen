import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { configureApplication } from '@/bootstrap';
import { JwtTokenType, PermissionCode, RoleCode } from '@/common/enums';
import type { AppConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';

const ACCESS_SECRET = 'e2e-access-secret-at-least-32-characters';

describe('Admin Users API with AppModule wiring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID();
  const adminId = randomUUID();
  const targetUserId = randomUUID();
  const regularUserId = randomUUID();
  const adminSessionId = randomUUID();
  const targetSessionId = randomUUID();
  const regularSessionId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });

    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

    configureApplication(app, appConfig);
    await app.init();

    prisma = app.get(PrismaService);

    await seedActorsAndAuthorization();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [adminId, targetUserId, regularUserId],
          },
        },
      });
    }

    await app?.close();
  });

  it('exposes list and detail routes from the real AppModule', async () => {
    const listResponse = await request(httpServer())
      .get('/api/v1/admin/users')
      .query({
        keyword: targetEmail(),
        status: 'ACTIVE',
        role: RoleCode.USER,
        offset: 0,
        limit: 10,
      })
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .expect(200);

    const list = unwrap<{
      total: number;
      users: Array<{
        id: string;
        email: string;
        createdAt: string;
      }>;
    }>(listResponse.body as unknown);

    expect(list.total).toBe(1);
    expect(list.users).toHaveLength(1);
    expect(list.users[0]).toMatchObject({
      id: targetUserId,
      email: targetEmail(),
    });
    expect(list.users[0]?.createdAt).toEqual(expect.any(String));

    const detailResponse = await request(httpServer())
      .get(`/api/v1/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .expect(200);

    expect(
      unwrap<{ id: string; activeSessionCount: number }>(
        detailResponse.body as unknown,
      ),
    ).toMatchObject({
      id: targetUserId,
      activeSessionCount: 1,
    });
  });

  it('updates status and immediately revokes active target sessions', async () => {
    const response = await request(httpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .set('x-request-id', `admin-users-${runId}-status`)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    expect(
      unwrap<{ id: string; status: string; activeSessionCount: number }>(
        response.body as unknown,
      ),
    ).toMatchObject({
      id: targetUserId,
      status: 'SUSPENDED',
      activeSessionCount: 0,
    });

    const revokedSession = await prisma.session.findUnique({
      where: { id: targetSessionId },
      select: { revokedAt: true, accessTokenVersion: true },
    });

    expect(revokedSession?.revokedAt).toBeInstanceOf(Date);
    expect(revokedSession?.accessTokenVersion).toBe(1);

    await request(httpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('assigns and removes the ADMIN role through the HTTP API', async () => {
    const assignedResponse = await request(httpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .send({ roleCode: RoleCode.ADMIN })
      .expect(201);

    const assignedRoleCodes = unwrap<{ roles: Array<{ code: string }> }>(
      assignedResponse.body as unknown,
    ).roles.map((role) => role.code);

    expect(assignedRoleCodes).toContain(RoleCode.ADMIN);

    const removedResponse = await request(httpServer())
      .delete(`/api/v1/admin/users/${targetUserId}/roles/${RoleCode.ADMIN}`)
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .expect(200);

    const remainingRoleCodes = unwrap<{ roles: Array<{ code: string }> }>(
      removedResponse.body as unknown,
    ).roles.map((role) => role.code);

    expect(remainingRoleCodes).not.toContain(RoleCode.ADMIN);
  });

  it('enforces authentication and user-management permission', async () => {
    await request(httpServer()).get('/api/v1/admin/users').expect(401);

    await request(httpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token(regularUserId, regularSessionId)}`)
      .expect(403);
  });

  function httpServer(): Parameters<typeof request>[0] {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  function token(userId: string, sessionId: string): string {
    return jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        typ: JwtTokenType.ACCESS,
        ver: 0,
      },
      ACCESS_SECRET,
      {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        expiresIn: '5m',
        jwtid: randomUUID(),
      },
    );
  }

  function unwrap<T>(body: unknown): T {
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as { data: T }).data;
    }

    return body as T;
  }

  function targetEmail(): string {
    return `admin-users-target-${runId}@example.test`;
  }

  async function seedActorsAndAuthorization(): Promise<void> {
    const [userManagePermission, roleManagePermission] = await Promise.all([
      prisma.permission.upsert({
        where: { code: PermissionCode.USER_MANAGE },
        update: {},
        create: {
          code: PermissionCode.USER_MANAGE,
          name: 'Manage users',
          resource: 'user',
          action: 'manage',
        },
      }),
      prisma.permission.upsert({
        where: { code: PermissionCode.ROLE_MANAGE },
        update: {},
        create: {
          code: PermissionCode.ROLE_MANAGE,
          name: 'Manage roles',
          resource: 'role',
          action: 'manage',
        },
      }),
    ]);

    const [userRole, adminRole] = await Promise.all([
      prisma.role.upsert({
        where: { code: RoleCode.USER },
        update: {},
        create: {
          code: RoleCode.USER,
          name: 'User',
          isSystem: true,
        },
      }),
      prisma.role.upsert({
        where: { code: RoleCode.ADMIN },
        update: {},
        create: {
          code: RoleCode.ADMIN,
          name: 'Admin',
          isSystem: true,
        },
      }),
    ]);

    await prisma.rolePermission.createMany({
      data: [
        {
          roleId: adminRole.id,
          permissionId: userManagePermission.id,
        },
        {
          roleId: adminRole.id,
          permissionId: roleManagePermission.id,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          email: `admin-users-admin-${runId}@example.test`,
          username: `admin_${runId.replaceAll('-', '').slice(0, 20)}`,
          displayName: 'Admin Users E2E Admin',
          emailVerifiedAt: new Date(),
        },
        {
          id: targetUserId,
          email: targetEmail(),
          username: `target_${runId.replaceAll('-', '').slice(0, 20)}`,
          displayName: 'Admin Users E2E Target',
          emailVerifiedAt: new Date(),
        },
        {
          id: regularUserId,
          email: `admin-users-regular-${runId}@example.test`,
          username: `regular_${runId.replaceAll('-', '').slice(0, 20)}`,
          displayName: 'Admin Users E2E Regular',
          emailVerifiedAt: new Date(),
        },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { userId: adminId, roleId: adminRole.id },
        { userId: targetUserId, roleId: userRole.id },
        { userId: regularUserId, roleId: userRole.id },
      ],
    });

    await prisma.session.createMany({
      data: [
        { id: adminSessionId, userId: adminId },
        { id: targetSessionId, userId: targetUserId },
        { id: regularSessionId, userId: regularUserId },
      ].map((session) => ({
        ...session,
        refreshTokenHash: `admin-users-refresh-${session.id}`,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      })),
    });
  }
});
