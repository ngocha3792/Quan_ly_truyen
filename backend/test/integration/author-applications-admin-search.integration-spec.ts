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
  AppConfigModule,
} from '@/config';

import {
  AuthorApplicationStatus as PrismaAuthorApplicationStatus,
} from '@/generated/prisma/client';

import {
  AuthorApplicationStatus,
} from '@/modules/author-applications/domain';

import {
  PrismaModule,
  PrismaService,
} from '@/infrastructure/database';

import {
  PrismaAuthorApplicationPersistence,
} from '@/modules/author-applications/infrastructure';

describe(
  'Author Application admin search PostgreSQL',

  () => {
    let moduleRef:
      TestingModule;

    let prisma:
      PrismaService;

    let persistence:
      PrismaAuthorApplicationPersistence;

    const runId =
      randomUUID();

    let sequence =
      0;

    beforeAll(
      async () => {
        moduleRef =
          await Test.createTestingModule({
            imports: [
              AppConfigModule,

              PrismaModule,
            ],

            providers: [
              PrismaAuthorApplicationPersistence,
            ],
          }).compile();

        await moduleRef.init();

        prisma =
          moduleRef.get(
            PrismaService,
          );

        persistence =
          moduleRef.get(
            PrismaAuthorApplicationPersistence,
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
      'search keyword không phân biệt hoa thường trên penName/fullName/email và vẫn áp dụng status',

      async () => {
        const penUser =
          await createUser(
            'pen',
          );

        const nameUser =
          await createUser(
            'name',
          );

        const emailUser =
          await createUser(
            'email',
          );

        const rejectedUser =
          await createUser(
            'rejected',
          );

        await createApplication(
          penUser.id,

          AuthorApplicationStatus.PENDING,

          {
            penName:
              'Moon Search Writer',

            fullName:
              'Nguyen Van A',

            email:
              `normal.${runId}@example.test`,
          },
        );

        await createApplication(
          nameUser.id,

          AuthorApplicationStatus.PENDING,

          {
            penName:
              'Another Pen',

            fullName:
              'SEARCH PERSON',

            email:
              `normal2.${runId}@example.test`,
          },
        );

        await createApplication(
          emailUser.id,

          AuthorApplicationStatus.PENDING,

          {
            penName:
              'Third Pen',

            fullName:
              'Another Person',

            email:
              `search-email.${runId}@example.test`,
          },
        );

        /*
         * Có keyword nhưng REJECTED.
         *
         * Query status=PENDING không được trả.
         */
        await createApplication(
          rejectedUser.id,

          AuthorApplicationStatus.REJECTED,

          {
            penName:
              'Search Rejected',

            fullName:
              'Search Rejected',

            email:
              `search-rejected.${runId}@example.test`,
          },
        );

        const byPen =
          await persistence.list({
            status:
              AuthorApplicationStatus.PENDING,

            keyword:
              'moon search',

            offset:
              0,

            limit:
              20,
          });

        expect(
          byPen.total,
        ).toBe(
          1,
        );

        expect(
          byPen.applications[0]
            ?.penName,
        ).toBe(
          'Moon Search Writer',
        );

        const byName =
          await persistence.list({
            status:
              AuthorApplicationStatus.PENDING,

            keyword:
              'search person',

            offset:
              0,

            limit:
              20,
          });

        expect(
          byName.total,
        ).toBe(
          1,
        );

        expect(
          byName.applications[0]
            ?.fullName,
        ).toBe(
          'SEARCH PERSON',
        );

        const byEmail =
          await persistence.list({
            status:
              AuthorApplicationStatus.PENDING,

            keyword:
              'SEARCH-EMAIL',

            offset:
              0,

            limit:
              20,
          });

        expect(
          byEmail.total,
        ).toBe(
          1,
        );
      },
    );

    async function createUser(
      label: string,
    ) {
      sequence +=
        1;

      return prisma.user.create({
        data: {
          email:
            `${label}.${sequence}.${runId}@user.test`,

          username:
            `${label}_${sequence}_${runId
              .replaceAll(
                '-',

                '',
              )
              .slice(
                0,

                14,
              )}`,

          passwordHash:
            'password-hash',

          displayName:
            `Author Search ${label}`,
        },
      });
    }

    async function createApplication(
      userId: string,

      status:
        AuthorApplicationStatus,

      values: {
        penName: string;

        fullName: string;

        email: string;
      },
    ) {
      return prisma.authorApplication.create({
        data: {
          userId,

          status:
            status as PrismaAuthorApplicationStatus,

          penName:
            values.penName,

          fullName:
            values.fullName,

          email:
            values.email,

          phone:
            '0900000000',

          portfolioUrl:
            'https://example.test',

          primaryGenre:
            'Fantasy',

          experience:
            '1-3-years',

          introduction:
            'Integration test introduction.',

          firstWorkSynopsis:
            'Integration test synopsis.',

          acceptedTerms:
            true,

          submittedAt:
            status ===
            AuthorApplicationStatus.DRAFT
              ? null
              : new Date(),

          reviewedAt:
            status ===
            AuthorApplicationStatus.REJECTED
              ? new Date()
              : null,

          rejectionReason:
            status ===
            AuthorApplicationStatus.REJECTED
              ? 'Integration rejected application'
              : null,
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
            OR: [
              {
                email: {
                  contains:
                    runId,
                },
              },

              {
                email: {
                  endsWith:
                    '@user.test',
                },

                displayName: {
                  startsWith:
                    'Author Search',
                },
              },
            ],
          },

          select: {
            id: true,
          },
        });

      if (
        users.length ===
        0
      ) {
        return;
      }

      const ids =
        users.map(
          (
            user,
          ) =>
            user.id,
        );

      await prisma.authorApplication.deleteMany({
        where: {
          userId: {
            in:
              ids,
          },
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
  },
);
