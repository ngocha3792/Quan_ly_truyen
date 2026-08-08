import {
  randomUUID,
} from 'node:crypto';

import type {
  TestingModule,
} from '@nestjs/testing';

import {
  Test,
} from '@nestjs/testing';

import {
  RequestContextStore,
} from '@/common/middlewares';

import {
  AppConfigModule,
} from '@/config';

import {
  PrismaModule,
  PrismaService,
} from '@/infrastructure/database';

import {
  AuthAuditWriterService,
} from '@/modules/auth/infrastructure/audit';

import {
  PrismaSessionManagementPersistence,
} from '@/modules/auth/infrastructure/persistence/prisma/repositories';

describe(
  'Auth Session Management PostgreSQL',

  () => {
    let moduleRef:
      TestingModule;

    let prisma:
      PrismaService;

    let persistence:
      PrismaSessionManagementPersistence;

    const runId =
      randomUUID();

    beforeAll(
      async () => {
        moduleRef =
          await Test.createTestingModule({
            imports: [
              AppConfigModule,

              PrismaModule,
            ],

            providers: [
              RequestContextStore,

              AuthAuditWriterService,

              PrismaSessionManagementPersistence,
            ],
          }).compile();

        await moduleRef.init();

        prisma =
          moduleRef.get(
            PrismaService,
          );

        persistence =
          moduleRef.get(
            PrismaSessionManagementPersistence,
          );
      },
    );

    afterEach(
      async () => {
        await cleanup();
      },
    );

    afterAll(
      async () => {
        await cleanup();

        await moduleRef.close();
      },
    );

    it(
      'revokeOtherUserSessions giữ current session và revoke mọi session khác atomically',

      async () => {
        const user =
          await createUser(
            'owner',
          );

        const otherUser =
          await createUser(
            'other',
          );

        const current =
          await createSession(
            user.id,

            'current',
          );

        const second =
          await createSession(
            user.id,

            'second',
          );

        const third =
          await createSession(
            user.id,

            'third',
          );

        const unrelated =
          await createSession(
            otherUser.id,

            'unrelated',
          );

        const revokedAt =
          new Date();

        const count =
          await persistence.revokeOtherUserSessions({
            userId:
              user.id,

            actorSessionId:
              current.id,

            revokedAt,

            reason:
              'user_revoked_other_sessions',
          });

        expect(
          count,
        ).toBe(
          2,
        );

        const freshCurrent =
          await prisma.session.findUniqueOrThrow({
            where: {
              id:
                current.id,
            },
          });

        expect(
          freshCurrent.revokedAt,
        ).toBeNull();

        expect(
          freshCurrent.accessTokenVersion,
        ).toBe(
          0,
        );

        const revokedSessions =
          await prisma.session.findMany({
            where: {
              id: {
                in: [
                  second.id,

                  third.id,
                ],
              },
            },
          });

        expect(
          revokedSessions.every(
            (
              session,
            ) =>
              session.revokedAt !==
              null,
          ),
        ).toBe(
          true,
        );

        expect(
          revokedSessions.every(
            (
              session,
            ) =>
              session.accessTokenVersion ===
              1,
          ),
        ).toBe(
          true,
        );

        expect(
          revokedSessions.every(
            (
              session,
            ) =>
              session.refreshTokenVersion ===
              1,
          ),
        ).toBe(
          true,
        );

        const unrelatedFresh =
          await prisma.session.findUniqueOrThrow({
            where: {
              id:
                unrelated.id,
            },
          });

        expect(
          unrelatedFresh.revokedAt,
        ).toBeNull();

        const audits =
          await prisma.auditLog.findMany({
            where: {
              actorId:
                user.id,

              entityType:
                'user',

              entityId:
                user.id,
            },
          });

        expect(
          audits.length,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );

    async function createUser(
      label: string,
    ) {
      return prisma.user.create({
        data: {
          email:
            `${label}.${runId}@example.test`,

          username:
            `${label}_${runId
              .replaceAll(
                '-',

                '',
              )
              .slice(
                0,

                16,
              )}`,

          passwordHash:
            'password-hash',

          displayName:
            `Session ${label}`,

          emailVerifiedAt:
            new Date(),
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

          refreshTokenHash:
            `${label}-${randomUUID()}`,

          refreshTokenFamilyId:
            randomUUID(),

          expiresAt:
            new Date(
              Date.now() +
                86_400_000,
            ),
        },
      });
    }

    async function cleanup(): Promise<void> {
      if (!prisma) {
        return;
      }

      const users =
        await prisma.user.findMany({
          where: {
            email: {
              contains:
                runId,
            },
          },

          select: {
            id: true,
          },
        });

      const ids =
        users.map(
          (
            user,
          ) =>
            user.id,
        );

      if (
        ids.length >
        0
      ) {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              {
                actorId: {
                  in:
                    ids,
                },
              },

              {
                entityId: {
                  in:
                    ids,
                },
              },
            ],
          },
        });

        await prisma.user.deleteMany({
          where: {
            id: {
              in:
                ids,
            },
          },
        });
      }
    }
  },
);
