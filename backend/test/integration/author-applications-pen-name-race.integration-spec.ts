import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';

import { Test } from '@nestjs/testing';

import { AppConfigModule } from '@/config';

import {
  AuthorApplicationStatus,
  MediaPurpose,
  MediaStatus,
} from '@/generated/prisma/client';

import { PrismaModule, PrismaService } from '@/infrastructure/database';

describe('AuthorApplication pending pen-name PostgreSQL invariant', () => {
  let moduleRef: TestingModule;

  let prisma: PrismaService;

  const runId = randomUUID();

  const compactRunId = runId.replaceAll(
    '-',

    '',
  );

  let sequence = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await cleanupRun();
  });

  afterAll(async () => {
    await cleanupRun();

    await moduleRef.close();
  });

  it('database chỉ được cho phép một PENDING application sở hữu cùng penName, không phân biệt hoa thường', async () => {
    const ownerA = await createUser('pen-name-race-a');

    const ownerB = await createUser('pen-name-race-b');

    const sharedPenName = `Moon ${compactRunId.slice(
      0,

      8,
    )}`;

    const applicationA = await createCompleteDraft(
      ownerA.id,

      sharedPenName,
    );

    const applicationB = await createCompleteDraft(
      ownerB.id,

      sharedPenName.toUpperCase(),
    );

    const sampleA = await createReadySample(
      ownerA.id,

      applicationA.id,
    );

    const sampleB = await createReadySample(
      ownerB.id,

      applicationB.id,
    );

    /*
     * Barrier cố ý đặt SAU availability check
     * và TRƯỚC UPDATE status=PENDING.
     *
     * Cả transaction A và B bắt buộc phải nhìn thấy:
     *
     * pendingOwner === null
     *
     * trước khi một trong hai được phép update.
     *
     * Nhờ đó test tái hiện race 100%,
     * không phụ thuộc scheduler/timing.
     */
    const barrier = createBarrier(2);

    const results = await Promise.allSettled([
      submitLikeTransaction({
        applicationId: applicationA.id,

        sampleMediaId: sampleA.id,

        penName: applicationA.penName!,

        barrier,
      }),

      submitLikeTransaction({
        applicationId: applicationB.id,

        sampleMediaId: sampleB.id,

        penName: applicationB.penName!,

        barrier,
      }),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<void> =>
        result.status === 'fulfilled',
    );

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    /*
     * Đây là database invariant ta muốn có sau Phase 4:
     *
     * unique LOWER(pen_name)
     * WHERE status = 'PENDING'
     *
     * Với schema hiện tại:
     *
     * fulfilled === 2
     * rejected === 0
     *
     * => test RED.
     */
    expect(fulfilled).toHaveLength(1);

    expect(rejected).toHaveLength(1);

    const pendingApplications = await prisma.authorApplication.findMany({
      where: {
        status: AuthorApplicationStatus.PENDING,

        penName: {
          equals: sharedPenName,

          mode: 'insensitive',
        },
      },

      select: {
        id: true,

        userId: true,

        penName: true,

        status: true,
      },
    });

    expect(pendingApplications).toHaveLength(1);
  });

  async function submitLikeTransaction(input: {
    applicationId: string;

    sampleMediaId: string;

    penName: string;

    barrier: ReturnType<typeof createBarrier>;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      /*
       * Mirror behavior của persistence hiện tại:
       * lock application của chính user.
       *
       * A lock row A.
       * B lock row B.
       *
       * Hai transaction không block lẫn nhau.
       */
      await tx.$queryRaw`
        SELECT "id"
        FROM "author_applications"
        WHERE "id" = ${input.applicationId}::uuid
        FOR UPDATE
      `;

      const pendingOwner = await tx.authorApplication.findFirst({
        where: {
          id: {
            not: input.applicationId,
          },

          status: AuthorApplicationStatus.PENDING,

          penName: {
            equals: input.penName,

            mode: 'insensitive',
          },
        },

        select: {
          id: true,
        },
      });

      /*
       * Cả A và B đều phải vượt qua check này
       * trước khi barrier mở.
       */
      expect(pendingOwner).toBeNull();

      await input.barrier.wait();

      /*
       * Không có DB constraint ở schema hiện tại
       * nên cả hai UPDATE đều thành công.
       *
       * Sau Phase 4:
       * một trong hai phải bị unique violation.
       */
      await tx.authorApplication.update({
        where: {
          id: input.applicationId,
        },

        data: {
          status: AuthorApplicationStatus.PENDING,

          sampleMediaId: input.sampleMediaId,

          submittedAt: new Date(),

          reviewedAt: null,

          reviewedById: null,

          rejectionReason: null,
        },
      });
    });
  }

  async function createUser(label: string): Promise<{
    id: string;
  }> {
    sequence += 1;

    const suffix = `${compactRunId.slice(
      0,

      8,
    )}${sequence}`;

    return prisma.user.create({
      data: {
        email: `${label}.${runId}.${sequence}@example.test`,

        username: `${label
          .replaceAll(
            '-',

            '_',
          )
          .slice(
            0,

            20,
          )}_${suffix}`,

        passwordHash: 'phase-0-regression-password-hash',

        displayName: `Phase 0 ${label}`,

        emailVerifiedAt: new Date(),
      },

      select: {
        id: true,
      },
    });
  }

  async function createCompleteDraft(
    userId: string,

    penName: string,
  ) {
    sequence += 1;

    return prisma.authorApplication.create({
      data: {
        userId,

        status: AuthorApplicationStatus.DRAFT,

        penName,

        fullName: 'Phase 0 Test Author',

        email: `application.${sequence}.${runId}@example.test`,

        phone: '0900000000',

        portfolioUrl: 'https://example.test/portfolio',

        primaryGenre: 'Fantasy',

        experience: '1-3-years',

        introduction: 'Phase 0 regression test introduction.',

        firstWorkSynopsis: 'Phase 0 regression test synopsis.',

        acceptedTerms: true,
      },
    });
  }

  async function createReadySample(
    uploaderId: string,

    applicationId: string,
  ) {
    sequence += 1;

    return prisma.mediaAsset.create({
      data: {
        uploaderId,

        purpose: MediaPurpose.AUTHOR_APPLICATION_SAMPLE,

        status: MediaStatus.READY,

        storageProvider: 'phase-0-regression',

        originalName: `author-app-phase0-${runId}-${sequence}.pdf`,

        mimeType: 'application/pdf',

        format: 'pdf',

        sizeBytes: BigInt(1024),

        secureUrl: `https://example.test/phase0/${sequence}.pdf`,

        readyAt: new Date(),

        metadata: {
          ownerId: applicationId,

          testRunId: runId,
        },
      },
    });
  }

  async function cleanupRun(): Promise<void> {
    if (!prisma) {
      return;
    }

    const applications = await prisma.authorApplication.findMany({
      where: {
        user: {
          email: {
            contains: runId,
          },
        },
      },

      select: {
        id: true,
      },
    });

    const applicationIds = applications.map(({ id }) => id);

    if (applicationIds.length > 0) {
      await prisma.authorApplication.deleteMany({
        where: {
          id: {
            in: applicationIds,
          },
        },
      });
    }

    await prisma.mediaAsset.deleteMany({
      where: {
        originalName: {
          startsWith: `author-app-phase0-${runId}`,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          contains: runId,
        },
      },
    });
  }
});

function createBarrier(parties: number): {
  wait(): Promise<void>;
} {
  if (!Number.isInteger(parties) || parties < 1) {
    throw new Error('Barrier parties must be a positive integer');
  }

  let arrived = 0;

  let release!: () => void;

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async wait(): Promise<void> {
      arrived += 1;

      if (arrived === parties) {
        release();
      }

      await gate;
    },
  };
}
