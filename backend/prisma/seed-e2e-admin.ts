import {
  randomUUID,
} from 'node:crypto';

import bcrypt from 'bcryptjs';

import {
  AccountStatus,
  AuthorApplicationStatus,
  AuthorLifecycleStatus,
  ChapterStatus,
  MediaPurpose,
  MediaStatus,
  ReportReason,
  ReportTargetType,
  StoryStatus,
  StoryVisibility,
} from '../src/generated/prisma/enums';

import {
  assertNotProduction,
} from '../scripts/shared/environment';

import {
  createScriptPrismaClient,
} from '../scripts/shared/prisma-client';

const prisma =
  createScriptPrismaClient();

const MANAGER_EMAIL =
  process.env[
    'E2E_MANAGER_EMAIL'
  ] ??
  'e2e.manager@truyenhub.test';

const MANAGER_PASSWORD =
  process.env[
    'E2E_MANAGER_PASSWORD'
  ] ??
  'E2eManager@2026';

const TARGET_EMAIL =
  'e2e.managed-user@truyenhub.test';

const APPROVE_EMAIL =
  'e2e.author.approve@truyenhub.test';

const REJECT_EMAIL =
  'e2e.author.reject@truyenhub.test';

const LIFECYCLE_AUTHOR_EMAIL =
  'e2e.lifecycle-author@truyenhub.test';

const MANAGER_ROLE_CODE =
  'E2E_MANAGER';

async function main():
  Promise<void> {
  assertNotProduction(
    'Preparing admin feature E2E data',
  );

  const [
    userRole,
    authorRole,
    adminRole,
  ] =
    await Promise.all([
      prisma.role.findUnique({
        where: {
          code:
            'USER',
        },
      }),

      prisma.role.findUnique({
        where: {
          code:
            'AUTHOR',
        },
      }),

      prisma.role.findUnique({
        where: {
          code:
            'ADMIN',
        },
      }),
    ]);

  if (
    !userRole ||
    !authorRole ||
    !adminRole
  ) {
    throw new Error(
      'USER/AUTHOR/ADMIN roles chưa được seed. Chạy db:seed trước.',
    );
  }

  const requiredPermissions = [
    'user.manage',

    'user.security.read',

    'user.security.manage',

    'role.manage',

    'story.review',

    'story.publish',

    'author-application.review',

    'author.read',

    'author.status.manage',

    'category.manage',

    'tag.manage',

    'comment.moderate',

    'report.review',

    'moderation.execute',
  ];

  const permissions =
    await prisma.permission.findMany({
      where: {
        code: {
          in:
            requiredPermissions,
        },
      },
    });

  if (
    permissions.length !==
    requiredPermissions.length
  ) {
    throw new Error(
      'Thiếu permission cần thiết cho E2E_MANAGER.',
    );
  }

  const managerRole =
    await prisma.role.upsert({
      where: {
        code:
          MANAGER_ROLE_CODE,
      },

      update: {
        name:
          'E2E Manager',

        description:
          'Playwright-only management role',

        isSystem:
          false,
      },

      create: {
        code:
          MANAGER_ROLE_CODE,

        name:
          'E2E Manager',

        description:
          'Playwright-only management role',

        isSystem:
          false,
      },
    });

  await prisma.rolePermission.deleteMany({
    where: {
      roleId:
        managerRole.id,
    },
  });

  await prisma.rolePermission.createMany({
    data:
      permissions.map(
        (
          permission,
        ) => ({
          roleId:
            managerRole.id,

          permissionId:
            permission.id,
        }),
      ),
  });

  const passwordHash =
    await bcrypt.hash(
      MANAGER_PASSWORD,

      10,
    );

  const manager =
    await upsertUser({
      email:
        MANAGER_EMAIL,

      username:
        'e2e_manager',

      displayName:
        'E2E Manager',

      passwordHash,
    });

  await resetRoles(
    manager.id,

    [
      userRole.id,

      managerRole.id,
    ],
  );

  /*
   * Safety ADMIN.
   *
   * Manager E2E không dùng ADMIN role để
   * tránh MFA, nhưng database invariant
   * cần một ACTIVE ADMIN để test remove ADMIN.
   */
  const safetyAdmin =
    await upsertUser({
      email:
        'e2e.guard-admin@truyenhub.test',

      username:
        'e2e_guard_admin',

      displayName:
        'E2E Guard Admin',

      passwordHash,
    });

  await resetRoles(
    safetyAdmin.id,

    [
      userRole.id,

      adminRole.id,
    ],
  );

  const target =
    await upsertUser({
      email:
        TARGET_EMAIL,

      username:
        'e2e_managed_user',

      displayName:
        'E2E Managed User',

      passwordHash,
    });

  await resetRoles(
    target.id,

    [
      userRole.id,
    ],
  );

  await prisma.session.create({
    data: {
      userId:
        target.id,

      refreshTokenHash:
        `e2e-managed-target-${randomUUID()}`,

      deviceId:
        'e2e-managed-target-device',

      deviceName:
        'E2E Target Browser',

      ipAddress:
        '127.0.0.1',

      userAgent:
        'Playwright seeded target session',

      lastUsedAt:
        new Date(),

      expiresAt:
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const lifecycleAuthorId =
    await prepareLifecycleAuthor({
      passwordHash,
      userRoleId:
        userRole.id,
      authorRoleId:
        authorRole.id,
    });

  await prepareTaxonomyFixtures(
    lifecycleAuthorId,
  );

  await prepareModerationFixture({
    reportedUserId: target.id,
    reporterId: lifecycleAuthorId,
  });

  await prepareAuthorApplicant({
    email:
      APPROVE_EMAIL,

    username:
      'e2e_author_approve',

    displayName:
      'E2E Author Approve',

    penName:
      'E2E Approve Pen',

    passwordHash,

    userRoleId:
      userRole.id,
  });

  await prepareAuthorApplicant({
    email:
      REJECT_EMAIL,

    username:
      'e2e_author_reject',

    displayName:
      'E2E Author Reject',

    penName:
      'E2E Reject Pen',

    passwordHash,

    userRoleId:
      userRole.id,
  });

  console.log(
    'Admin feature E2E data ready.',
  );
}

async function upsertUser(
  input: {
    email:
      string;

    username:
      string;

    displayName:
      string;

    passwordHash:
      string;
  },
) {
  const now =
    new Date();

  const user =
    await prisma.user.upsert({
      where: {
        email:
          input.email,
      },

      update: {
        username:
          input.username,

        displayName:
          input.displayName,

        passwordHash:
          input.passwordHash,

        passwordUpdatedAt:
          now,

        emailVerifiedAt:
          now,

        status:
          AccountStatus.ACTIVE,

        deletedAt:
          null,
      },

      create: {
        email:
          input.email,

        username:
          input.username,

        displayName:
          input.displayName,

        passwordHash:
          input.passwordHash,

        passwordUpdatedAt:
          now,

        emailVerifiedAt:
          now,

        status:
          AccountStatus.ACTIVE,
      },
    });

  /*
   * Mỗi Playwright run bắt đầu từ
   * session state sạch.
   */
  await prisma.session.deleteMany({
    where: {
      userId:
        user.id,
    },
  });

  await prisma.userToken.deleteMany({
    where: {
      userId:
        user.id,
    },
  });

  return user;
}

async function resetRoles(
  userId: string,

  roleIds:
    readonly string[],
): Promise<void> {
  await prisma.userRole.deleteMany({
    where: {
      userId,
    },
  });

  await prisma.userRole.createMany({
    data:
      roleIds.map(
        (
          roleId,
        ) => ({
          userId,

          roleId,
        }),
      ),
  });
}

async function prepareLifecycleAuthor(
  input: {
    passwordHash:
      string;

    userRoleId:
      string;

    authorRoleId:
      string;
  },
): Promise<string> {
  const user =
    await upsertUser({
      email:
        LIFECYCLE_AUTHOR_EMAIL,

      username:
        'e2e_lifecycle_author',

      displayName:
        'E2E Lifecycle Author',

      passwordHash:
        input.passwordHash,
    });

  await resetRoles(
    user.id,

    [
      input.userRoleId,
      input.authorRoleId,
    ],
  );

  await prisma.story.deleteMany({
    where: {
      authorId:
        user.id,
    },
  });

  await prisma.authorProfile.upsert({
    where: {
      userId:
        user.id,
    },

    update: {
      penName:
        'E2E Lifecycle Pen',

      slug:
        'e2e-lifecycle-pen',

      lifecycleStatus:
        AuthorLifecycleStatus.ACTIVE,

      statusReason:
        null,

      statusUpdatedAt:
        null,

      statusUpdatedBy:
        null,

      storyCount:
        2,
    },

    create: {
      userId:
        user.id,

      penName:
        'E2E Lifecycle Pen',

      slug:
        'e2e-lifecycle-pen',

      lifecycleStatus:
        AuthorLifecycleStatus.ACTIVE,

      storyCount:
        2,
    },
  });

  const pendingStory =
    await prisma.story.create({
      data: {
        authorId:
          user.id,

        title:
          'E2E Pending Moderation Story',

        slug:
          'e2e-pending-moderation-story',

        synopsis:
          'Pending story seeded for admin moderation Playwright coverage.',

        status:
          StoryStatus.PENDING_REVIEW,

        visibility:
          StoryVisibility.PRIVATE,

        chapterCount:
          1,
      },
    });

  await prisma.chapter.create({
    data: {
      storyId:
        pendingStory.id,

      createdById:
        user.id,

      updatedById:
        user.id,

      number:
        1,

      title:
        'E2E moderation chapter',

      slug:
        'e2e-moderation-chapter',

      content:
        'Nội dung chương E2E để admin kiểm tra trước khi reject.',

      status:
        ChapterStatus.DRAFT,
    },
  });

  await prisma.storySubmission.create({
    data: {
      storyId:
        pendingStory.id,

      submittedById:
        user.id,

      authorNote:
        'E2E moderation submission',
    },
  });

  await prisma.story.create({
    data: {
      authorId:
        user.id,

      title:
        'E2E Published Lifecycle Story',

      slug:
        'e2e-published-lifecycle-story',

      synopsis:
        'Published story retained while lifecycle capability changes.',

      status:
        StoryStatus.PUBLISHED,

      visibility:
        StoryVisibility.PUBLIC,

      publishedAt:
        new Date(),
    },
  });

  return user.id;
}

async function prepareTaxonomyFixtures(
  authorId: string,
): Promise<void> {
  const sourceTag =
    await prisma.tag.upsert({
      where: { slug: 'e2e-sci-fi' },
      update: { name: 'E2E Sci Fi' },
      create: { name: 'E2E Sci Fi', slug: 'e2e-sci-fi' },
    });

  const targetTag =
    await prisma.tag.upsert({
      where: { slug: 'e2e-science-fiction' },
      update: { name: 'E2E Science Fiction' },
      create: { name: 'E2E Science Fiction', slug: 'e2e-science-fiction' },
    });

  const category =
    await prisma.category.upsert({
      where: { slug: 'e2e-legacy-fantasy' },
      update: { name: 'E2E Legacy Fantasy', isActive: true, parentId: null },
      create: { name: 'E2E Legacy Fantasy', slug: 'e2e-legacy-fantasy', isActive: true },
    });

  const draft =
    await prisma.story.create({
      data: {
        authorId,
        title: 'E2E Taxonomy Legacy Story',
        slug: 'e2e-taxonomy-legacy-story',
        synopsis: 'Story used to verify inactive category compatibility.',
        status: StoryStatus.DRAFT,
        visibility: StoryVisibility.PRIVATE,
        categories: { create: { categoryId: category.id, isPrimary: true } },
        tags: { create: [{ tagId: sourceTag.id }] },
      },
    });

  const pending =
    await prisma.story.findUniqueOrThrow({
      where: { slug: 'e2e-pending-moderation-story' },
      select: { id: true },
    });

  await prisma.storyTag.createMany({
    data: [
      { storyId: pending.id, tagId: sourceTag.id },
      { storyId: pending.id, tagId: targetTag.id },
    ],
    skipDuplicates: true,
  });

  await prisma.authorProfile.update({
    where: { userId: authorId },
    data: { storyCount: 3 },
  });

  void draft;
}

async function prepareModerationFixture(input: {
  reportedUserId: string;
  reporterId: string;
}): Promise<void> {
  const story = await prisma.story.findUniqueOrThrow({
    where: { slug: 'e2e-published-lifecycle-story' },
    select: { id: true },
  });

  const previous = await prisma.comment.findMany({
    where: { storyId: story.id, userId: input.reportedUserId, body: { contains: 'E2E moderation current' } },
    select: { id: true },
  });
  if (previous.length > 0) {
    const ids = previous.map((item) => item.id);
    await prisma.moderationAction.deleteMany({ where: { commentId: { in: ids } } });
    await prisma.report.deleteMany({ where: { commentId: { in: ids } } });
    await prisma.commentReaction.deleteMany({ where: { commentId: { in: ids } } });
    await prisma.comment.deleteMany({ where: { id: { in: ids } } });
  }

  const reportCreatedAt = new Date(Date.now() - 5 * 60 * 1000);
  const editedAt = new Date();
  const comment = await prisma.comment.create({
    data: {
      storyId: story.id,
      userId: input.reportedUserId,
      body: 'E2E moderation current edited content',
      editedAt,
    },
  });
  await prisma.story.update({ where: { id: story.id }, data: { commentCount: 1 } });
  await prisma.report.create({
    data: {
      reporterId: input.reporterId,
      targetType: ReportTargetType.COMMENT,
      storyId: story.id,
      commentId: comment.id,
      reportedUserId: input.reportedUserId,
      reason: ReportReason.HARASSMENT,
      description: 'E2E report dùng để kiểm tra immutable evidence và moderation workflow.',
      evidence: {
        comment: {
          id: comment.id,
          body: 'E2E original harassment evidence',
          authorId: input.reportedUserId,
          createdAt: reportCreatedAt.toISOString(),
          editedAt: null,
          moderationStatus: 'VISIBLE',
        },
        context: { storyId: story.id, chapterId: null },
      },
      createdAt: reportCreatedAt,
    },
  });
}

async function prepareAuthorApplicant(
  input: {
    email:
      string;

    username:
      string;

    displayName:
      string;

    penName:
      string;

    passwordHash:
      string;

    userRoleId:
      string;
  },
): Promise<void> {
  const user =
    await upsertUser({
      email:
        input.email,

      username:
        input.username,

      displayName:
        input.displayName,

      passwordHash:
        input.passwordHash,
    });

  await resetRoles(
    user.id,

    [
      input.userRoleId,
    ],
  );

  await prisma.authorProfile.deleteMany({
    where: {
      userId:
        user.id,
    },
  });

  const oldApplications =
    await prisma.authorApplication.findMany({
      where: {
        userId:
          user.id,
      },

      select: {
        sampleMediaId:
          true,
      },
    });

  await prisma.authorApplication.deleteMany({
    where: {
      userId:
        user.id,
    },
  });

  const oldMediaIds =
    oldApplications
      .map(
        (
          application,
        ) =>
          application.sampleMediaId,
      )
      .filter(
        (
          value,
        ): value is string =>
          value !==
          null,
      );

  if (
    oldMediaIds.length >
    0
  ) {
    await prisma.mediaAsset.deleteMany({
      where: {
        id: {
          in:
            oldMediaIds,
        },
      },
    });
  }

  const applicationId =
    randomUUID();

  await prisma.authorApplication.create({
    data: {
      id:
        applicationId,

      userId:
        user.id,

      status:
        AuthorApplicationStatus.PENDING,

      penName:
        input.penName,

      fullName:
        input.displayName,

      email:
        input.email,

      phone:
        '0900000000',

      portfolioUrl:
        'https://example.test/portfolio',

      primaryGenre:
        'Fantasy',

      experience:
        '1-3-years',

      introduction:
        'Đây là hồ sơ E2E dùng để kiểm thử quy trình xét duyệt tác giả.',

      firstWorkSynopsis:
        'Đây là nội dung mẫu E2E cho quy trình xét duyệt tác giả.',

      acceptedTerms:
        true,

      submittedAt:
        new Date(),
    },
  });

  const media =
    await prisma.mediaAsset.create({
      data: {
        uploaderId:
          user.id,

        purpose:
          MediaPurpose.AUTHOR_APPLICATION_SAMPLE,

        status:
          MediaStatus.READY,

        storageProvider:
          'e2e',

        originalName:
          `${input.username}.pdf`,

        mimeType:
          'application/pdf',

        format:
          'pdf',

        sizeBytes:
          BigInt(
            2048,
          ),

        secureUrl:
          `https://example.test/${input.username}.pdf`,

        readyAt:
          new Date(),

        metadata: {
          ownerId:
            applicationId,

          e2e:
            true,
        },
      },
    });

  await prisma.authorApplication.update({
    where: {
      id:
        applicationId,
    },

    data: {
      sampleMediaId:
        media.id,
    },
  });
}

void main()
  .catch(
    (
      error,
    ) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
