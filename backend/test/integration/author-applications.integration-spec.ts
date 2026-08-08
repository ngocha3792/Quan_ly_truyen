import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';

import { Test } from '@nestjs/testing';

import { RoleCode } from '@/common/enums';

import { AppConfigModule } from '@/config';

import {
  AuthorApplicationStatus,
  MediaPurpose,
  MediaStatus,
} from '@/generated/prisma/client';

import { PrismaModule, PrismaService } from '@/infrastructure/database';

import { PrismaAuthorApplicationPersistence } from '@/modules/author-applications/infrastructure';

describe('AuthorApplication PostgreSQL invariants', () => {
  let moduleRef: TestingModule;

  let prisma: PrismaService;

  let persistence: PrismaAuthorApplicationPersistence;

  let authorRoleId: string;

  const runId = randomUUID();

  const compactRunId = runId.replaceAll(
    '-',

    '',
  );

  let sequence = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],

      providers: [PrismaAuthorApplicationPersistence],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);

    persistence = moduleRef.get(PrismaAuthorApplicationPersistence);

    const authorRole = await prisma.role.upsert({
      where: {
        code: RoleCode.AUTHOR,
      },

      update: {},

      create: {
        code: RoleCode.AUTHOR,

        name: 'Author',

        description: 'Author role for integration test',

        isSystem: true,
      },

      select: {
        id: true,
      },
    });

    authorRoleId = authorRole.id;
  });

  afterEach(async () => {
    await cleanupRun();
  });

  afterAll(async () => {
    await cleanupRun();

    await moduleRef.close();
  });

  it('approve + reject concurrent chỉ cho phép đúng một transition thắng', async () => {
    const owner = await createUser('review-race-owner');

    const reviewerA = await createUser('review-race-admin-a');

    const reviewerB = await createUser('review-race-admin-b');

    const application = await createPendingApplication(owner.id);

    const reviewedAt = new Date();

    const [approveResult, rejectResult] = await Promise.all([
      persistence.approve({
        applicationId: application.id,

        reviewerId: reviewerA.id,

        reviewedAt,

        audit: {
          requestId: requestId('approve-race'),

          ipAddress: '127.0.0.1',

          userAgent: 'Jest integration',
        },
      }),

      persistence.reject({
        applicationId: application.id,

        reviewerId: reviewerB.id,

        reviewedAt,

        reason: 'Rejected by concurrent reviewer',

        audit: {
          requestId: requestId('reject-race'),

          ipAddress: '127.0.0.1',

          userAgent: 'Jest integration',
        },
      }),
    ]);

    const statuses = [approveResult.status, rejectResult.status];

    const successfulTransitions = statuses.filter(
      (status) => status === 'approved' || status === 'rejected',
    );

    expect(successfulTransitions).toHaveLength(1);

    expect(statuses.filter((status) => status === 'not_pending')).toHaveLength(
      1,
    );

    const freshApplication = await prisma.authorApplication.findUniqueOrThrow({
      where: {
        id: application.id,
      },

      select: {
        status: true,
      },
    });

    const authorProfile = await prisma.authorProfile.findUnique({
      where: {
        userId: owner.id,
      },

      select: {
        userId: true,
      },
    });

    const authorRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: owner.id,

          roleId: authorRoleId,
        },
      },
    });

    if (successfulTransitions[0] === 'approved') {
      expect(freshApplication.status).toBe(AuthorApplicationStatus.APPROVED);

      expect(authorProfile).not.toBeNull();

      expect(authorRole).not.toBeNull();
    } else {
      expect(freshApplication.status).toBe(AuthorApplicationStatus.REJECTED);

      /*
       * Invariant quan trọng:
       *
       * REJECTED tuyệt đối không được
       * đi cùng AuthorProfile/AUTHOR role.
       */
      expect(authorProfile).toBeNull();

      expect(authorRole).toBeNull();
    }
  });

  it('approve + approve concurrent chỉ tạo một AuthorProfile và một AUTHOR role', async () => {
    const owner = await createUser('double-approve-owner');

    const reviewerA = await createUser('double-approve-a');

    const reviewerB = await createUser('double-approve-b');

    const application = await createPendingApplication(owner.id);

    const [first, second] = await Promise.all([
      persistence.approve({
        applicationId: application.id,

        reviewerId: reviewerA.id,

        reviewedAt: new Date(),

        audit: {
          requestId: requestId('double-approve-a'),
        },
      }),

      persistence.approve({
        applicationId: application.id,

        reviewerId: reviewerB.id,

        reviewedAt: new Date(),

        audit: {
          requestId: requestId('double-approve-b'),
        },
      }),
    ]);

    const statuses = [first.status, second.status];

    expect(statuses.filter((status) => status === 'approved')).toHaveLength(1);

    expect(statuses.filter((status) => status === 'not_pending')).toHaveLength(
      1,
    );

    const freshApplication = await prisma.authorApplication.findUniqueOrThrow({
      where: {
        id: application.id,
      },
    });

    expect(freshApplication.status).toBe(AuthorApplicationStatus.APPROVED);

    expect(
      await prisma.authorProfile.count({
        where: {
          userId: owner.id,
        },
      }),
    ).toBe(1);

    expect(
      await prisma.userRole.count({
        where: {
          userId: owner.id,

          roleId: authorRoleId,
        },
      }),
    ).toBe(1);
  });

  it('saveDraft + submit concurrent không cho phép draft ghi đè application sau PENDING', async () => {
    const owner = await createUser('draft-submit-owner');

    const application = await createCompleteDraft(owner.id);

    const sample = await createReadySample(
      owner.id,

      application.id,

      MediaPurpose.AUTHOR_APPLICATION_SAMPLE,
    );

    const originalIntroduction = application.introduction;

    const updatedIntroduction = `Updated introduction ${runId}`;

    const [saveResult, submitResult] = await Promise.all([
      persistence.saveDraft({
        userId: owner.id,

        introduction: updatedIntroduction,
      }),

      persistence.submit({
        userId: owner.id,

        applicationId: application.id,

        sampleMediaId: sample.id,

        submittedAt: new Date(),

        audit: {
          requestId: requestId('draft-submit'),
        },
      }),
    ]);

    expect(submitResult.status).toBe('submitted');

    expect(['saved', 'pending']).toContain(saveResult.status);

    const fresh = await prisma.authorApplication.findUniqueOrThrow({
      where: {
        id: application.id,
      },

      select: {
        status: true,

        introduction: true,

        sampleMediaId: true,
      },
    });

    expect(fresh.status).toBe(AuthorApplicationStatus.PENDING);

    expect(fresh.sampleMediaId).toBe(sample.id);

    /*
     * Nếu saveDraft lấy lock trước:
     * submit phải đọc bản draft mới.
     *
     * Nếu submit lấy lock trước:
     * saveDraft phải trả pending
     * và không được ghi.
     */
    if (saveResult.status === 'saved') {
      expect(fresh.introduction).toBe(updatedIntroduction);
    } else {
      expect(fresh.introduction).toBe(originalIntroduction);
    }

    const introductionBeforeIllegalSave = fresh.introduction;

    /*
     * Kiểm tra deterministic thêm một lần:
     * application đã PENDING thì draft mutation
     * chắc chắn bị khóa.
     */
    const illegalSave = await persistence.saveDraft({
      userId: owner.id,

      introduction: 'THIS MUST NEVER BE WRITTEN',
    });

    expect(illegalSave.status).toBe('pending');

    const afterIllegalSave = await prisma.authorApplication.findUniqueOrThrow({
      where: {
        id: application.id,
      },

      select: {
        introduction: true,
      },
    });

    expect(afterIllegalSave.introduction).toBe(introductionBeforeIllegalSave);
  });

  it('không chấp nhận generic ATTACHMENT làm author application sample', async () => {
    const owner = await createUser('media-policy-owner');

    const application = await createCompleteDraft(owner.id);

    /*
     * Đây mô phỏng client bypass frontend
     * và có được một generic ATTACHMENT.
     */
    const genericAttachment = await createReadySample(
      owner.id,

      application.id,

      MediaPurpose.ATTACHMENT,
    );

    const invalidResult = await persistence.submit({
      userId: owner.id,

      applicationId: application.id,

      sampleMediaId: genericAttachment.id,

      submittedAt: new Date(),

      audit: {
        requestId: requestId('generic-attachment'),
      },
    });

    expect(invalidResult.status).toBe('invalid_sample');

    const afterInvalidSubmit = await prisma.authorApplication.findUniqueOrThrow(
      {
        where: {
          id: application.id,
        },

        select: {
          status: true,

          sampleMediaId: true,
        },
      },
    );

    expect(afterInvalidSubmit.status).toBe(AuthorApplicationStatus.DRAFT);

    expect(afterInvalidSubmit.sampleMediaId).toBeNull();

    /*
     * Purpose đúng phải submit được.
     */
    const properSample = await createReadySample(
      owner.id,

      application.id,

      MediaPurpose.AUTHOR_APPLICATION_SAMPLE,
    );

    const validResult = await persistence.submit({
      userId: owner.id,

      applicationId: application.id,

      sampleMediaId: properSample.id,

      submittedAt: new Date(),

      audit: {
        requestId: requestId('proper-sample'),
      },
    });

    expect(validResult.status).toBe('submitted');

    const afterValidSubmit = await prisma.authorApplication.findUniqueOrThrow({
      where: {
        id: application.id,
      },

      select: {
        status: true,

        sampleMediaId: true,
      },
    });

    expect(afterValidSubmit.status).toBe(AuthorApplicationStatus.PENDING);

    expect(afterValidSubmit.sampleMediaId).toBe(properSample.id);
  });

  async function createUser(label: string): Promise<{
    id: string;
  }> {
    sequence += 1;

    const suffix = `${compactRunId.slice(
      0,

      10,
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

            25,
          )}_${suffix}`,

        passwordHash: 'integration-test-password-hash',

        displayName: `Integration ${label}`,

        emailVerifiedAt: new Date(),
      },

      select: {
        id: true,
      },
    });
  }

  async function createPendingApplication(userId: string) {
    return prisma.authorApplication.create({
      data: {
        userId,

        status: AuthorApplicationStatus.PENDING,

        ...completeApplicationFields(),

        submittedAt: new Date(),
      },
    });
  }

  async function createCompleteDraft(userId: string) {
    return prisma.authorApplication.create({
      data: {
        userId,

        status: AuthorApplicationStatus.DRAFT,

        ...completeApplicationFields(),
      },
    });
  }

  function completeApplicationFields() {
    sequence += 1;

    return {
      penName: `Pen ${compactRunId.slice(
        0,

        8,
      )} ${sequence}`,

      fullName: 'Integration Test Author',

      email: `application.${sequence}.${runId}@example.test`,

      phone: '0900000000',

      portfolioUrl: 'https://example.test/portfolio',

      primaryGenre: 'Fantasy',

      experience: '1-3-years',

      introduction: `Original introduction ${sequence}`,

      firstWorkSynopsis: `Integration synopsis ${sequence}`,

      acceptedTerms: true,
    };
  }

  async function createReadySample(
    uploaderId: string,

    applicationId: string,

    purpose: MediaPurpose,
  ) {
    sequence += 1;

    return prisma.mediaAsset.create({
      data: {
        uploaderId,

        purpose,

        status: MediaStatus.READY,

        storageProvider: 'integration-test',

        originalName: `author-app-it-${runId}-${sequence}.pdf`,

        mimeType: 'application/pdf',

        format: 'pdf',

        sizeBytes: BigInt(1024),

        secureUrl: `https://example.test/${sequence}.pdf`,

        readyAt: new Date(),

        metadata: {
          ownerId: applicationId,

          testRunId: runId,
        },
      },
    });
  }

  function requestId(label: string): string {
    sequence += 1;

    return `aa-it-${label}-${runId}-${sequence}`;
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

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          {
            requestId: {
              contains: runId,
            },
          },

          ...(applicationIds.length > 0
            ? [
                {
                  entityType: 'author_application',

                  entityId: {
                    in: applicationIds,
                  },
                },
              ]
            : []),
        ],
      },
    });

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
          startsWith: `author-app-it-${runId}`,
        },
      },
    });

    /*
     * AuthorProfile/UserRole cascade theo User.
     */
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: runId,
        },
      },
    });
  }
});
