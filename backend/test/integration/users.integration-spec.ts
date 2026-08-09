import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';

import { Test } from '@nestjs/testing';

import { RoleCode } from '@/common/enums';

import { AppConfigModule } from '@/config';

import { AccountStatus } from '@/generated/prisma/client';

import { PrismaModule, PrismaService } from '@/infrastructure/database';

import {
  PrismaManagedUserRepository,
  PrismaUserProfileRepository,
} from '@/modules/users/infrastructure';

import { ManagedUserStatus } from '@/modules/users/domain';

describe('Users PostgreSQL invariants', () => {
  let moduleRef: TestingModule;

  let prisma: PrismaService;

  let profileRepository: PrismaUserProfileRepository;

  let managedRepository: PrismaManagedUserRepository;

  let userRoleId: string;

  let adminRoleId: string;

  const runId = randomUUID();

  let sequence = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],

      providers: [PrismaUserProfileRepository, PrismaManagedUserRepository],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);

    profileRepository = moduleRef.get(PrismaUserProfileRepository);

    managedRepository = moduleRef.get(PrismaManagedUserRepository);

    const userRole = await prisma.role.upsert({
      where: {
        code: RoleCode.USER,
      },

      update: {},

      create: {
        code: RoleCode.USER,

        name: 'User',

        isSystem: true,
      },

      select: {
        id: true,
      },
    });

    const adminRole = await prisma.role.upsert({
      where: {
        code: RoleCode.ADMIN,
      },

      update: {},

      create: {
        code: RoleCode.ADMIN,

        name: 'Admin',

        isSystem: true,
      },

      select: {
        id: true,
      },
    });

    userRoleId = userRole.id;

    adminRoleId = adminRole.id;
  });

  afterEach(async () => {
    await cleanupRun();
  });

  afterAll(async () => {
    await cleanupRun();

    await moduleRef.close();
  });

  it('hai PATCH preferences concurrent không được làm mất thay đổi của nhau', async () => {
    const user = await createUser('preference-race');

    await prisma.notificationPreference.create({
      data: {
        userId: user.id,

        emailEnabled: true,

        newChapterEnabled: true,

        preferences: {
          showRecentActivity: true,
        },
      },
    });

    const changedAt = new Date();

    const [first, second] = await Promise.all([
      profileRepository.updatePreferences({
        userId: user.id,

        newChapterNotifications: false,

        changedAt,

        audit: {
          requestId: requestId('pref-new-chapter'),
        },
      }),

      profileRepository.updatePreferences({
        userId: user.id,

        allowUpdateEmails: false,

        changedAt,

        audit: {
          requestId: requestId('pref-email'),
        },
      }),
    ]);

    expect(first.status).toBe('updated');

    expect(second.status).toBe('updated');

    const fresh = await prisma.notificationPreference.findUniqueOrThrow({
      where: {
        userId: user.id,
      },
    });

    expect(fresh.newChapterEnabled).toBe(false);

    expect(fresh.emailEnabled).toBe(false);

    expect(fresh.preferences).toMatchObject({
      showRecentActivity: true,
    });
  });

  it('suspend user phải revoke toàn bộ active sessions trong cùng operation', async () => {
    const actor = await createUser('status-actor');

    const target = await createUser('status-target');

    await assignRole(
      actor.id,

      adminRoleId,
    );

    const sessionA = await createSession(
      target.id,

      'status-a',
    );

    const sessionB = await createSession(
      target.id,

      'status-b',
    );

    const result = await managedRepository.updateManagedUserStatus({
      actorUserId: actor.id,

      targetUserId: target.id,

      status: ManagedUserStatus.SUSPENDED,

      changedAt: new Date(),

      audit: {
        requestId: requestId('suspend-user'),
      },
    });

    expect(result.status).toBe('updated');

    const freshUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: target.id,
      },

      select: {
        status: true,
      },
    });

    expect(freshUser.status).toBe(AccountStatus.SUSPENDED);

    const sessions = await prisma.session.findMany({
      where: {
        id: {
          in: [sessionA.id, sessionB.id],
        },
      },

      orderBy: {
        id: 'asc',
      },
    });

    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);

    expect(sessions.every((session) => session.accessTokenVersion === 1)).toBe(
      true,
    );

    expect(sessions.every((session) => session.refreshTokenVersion === 1)).toBe(
      true,
    );
  });

  it('activate lại user không được làm session cũ sống lại', async () => {
    const actor = await createUser('activate-actor');

    const target = await createUser('activate-target');

    await assignRole(
      actor.id,

      adminRoleId,
    );

    const session = await createSession(
      target.id,

      'old-session',
    );

    await managedRepository.updateManagedUserStatus({
      actorUserId: actor.id,

      targetUserId: target.id,

      status: ManagedUserStatus.SUSPENDED,

      changedAt: new Date(),

      audit: {
        requestId: requestId('first-suspend'),
      },
    });

    const activateResult = await managedRepository.updateManagedUserStatus({
      actorUserId: actor.id,

      targetUserId: target.id,

      status: ManagedUserStatus.ACTIVE,

      changedAt: new Date(),

      audit: {
        requestId: requestId('activate'),
      },
    });

    expect(activateResult.status).toBe('updated');

    const freshSession = await prisma.session.findUniqueOrThrow({
      where: {
        id: session.id,
      },
    });

    expect(freshSession.revokedAt).not.toBeNull();

    const freshUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: target.id,
      },
    });

    expect(freshUser.status).toBe(AccountStatus.ACTIVE);
  });

  it('assign ADMIN phải idempotent và không tạo duplicate UserRole', async () => {
    const actor = await createUser('assign-admin-actor');

    const target = await createUser('assign-admin-target');

    await assignRole(
      actor.id,

      adminRoleId,
    );

    const first = await managedRepository.assignManagedUserRole({
      actorUserId: actor.id,

      targetUserId: target.id,

      roleCode: RoleCode.ADMIN,

      changedAt: new Date(),

      audit: {
        requestId: requestId('admin-grant-1'),
      },
    });

    const second = await managedRepository.assignManagedUserRole({
      actorUserId: actor.id,

      targetUserId: target.id,

      roleCode: RoleCode.ADMIN,

      changedAt: new Date(),

      audit: {
        requestId: requestId('admin-grant-2'),
      },
    });

    expect(first.status).toBe('updated');

    expect(second.status).toBe('unchanged');

    expect(
      await prisma.userRole.count({
        where: {
          userId: target.id,

          roleId: adminRoleId,
        },
      }),
    ).toBe(1);
  });

  it('remove ADMIN phải revoke toàn bộ session của target', async () => {
    const actor = await createUser('remove-admin-actor');

    const target = await createUser('remove-admin-target');

    /*
     * Có ít nhất 2 ACTIVE admin:
     *
     * actor + target
     *
     * nên target được phép mất ADMIN.
     */
    await assignRole(
      actor.id,

      adminRoleId,
    );

    await assignRole(
      target.id,

      adminRoleId,
    );

    const session = await createSession(
      target.id,

      'remove-admin-session',
    );

    const result = await managedRepository.removeManagedUserRole({
      actorUserId: actor.id,

      targetUserId: target.id,

      roleCode: RoleCode.ADMIN,

      changedAt: new Date(),

      audit: {
        requestId: requestId('remove-admin'),
      },
    });

    expect(result.status).toBe('updated');

    const assignment = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: target.id,

          roleId: adminRoleId,
        },
      },
    });

    expect(assignment).toBeNull();

    const freshSession = await prisma.session.findUniqueOrThrow({
      where: {
        id: session.id,
      },
    });

    expect(freshSession.revokedAt).not.toBeNull();

    expect(freshSession.accessTokenVersion).toBe(1);

    expect(freshSession.refreshTokenVersion).toBe(1);
  });

  async function createUser(label: string) {
    sequence += 1;

    const compact = runId
      .replaceAll(
        '-',

        '',
      )
      .slice(
        0,

        12,
      );

    const user = await prisma.user.create({
      data: {
        email: `${label}.${sequence}.${runId}@example.test`,

        username: `${label
          .replaceAll(
            '-',

            '_',
          )
          .slice(
            0,

            24,
          )}_${compact}_${sequence}`,

        passwordHash: 'integration-password-hash',

        displayName: `Integration ${label}`,

        emailVerifiedAt: new Date(),
      },
    });

    await assignRole(
      user.id,

      userRoleId,
    );

    return user;
  }

  async function assignRole(
    userId: string,

    roleId: string,
  ): Promise<void> {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,

          roleId,
        },
      },

      update: {
        expiresAt: null,
      },

      create: {
        userId,

        roleId,
      },
    });
  }

  async function createSession(
    userId: string,

    label: string,
  ) {
    return prisma.session.create({
      data: {
        userId,

        refreshTokenHash: `${label}-${randomUUID()}`,

        refreshTokenFamilyId: randomUUID(),

        deviceName: `Integration ${label}`,

        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  function requestId(label: string): string {
    sequence += 1;

    return `users-it-${label}-${runId}-${sequence}`;
  }

  async function cleanupRun(): Promise<void> {
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

    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            {
              actorId: {
                in: userIds,
              },
            },

            {
              entityId: {
                in: userIds,
              },
            },

            {
              requestId: {
                contains: runId,
              },
            },
          ],
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
  }
});
