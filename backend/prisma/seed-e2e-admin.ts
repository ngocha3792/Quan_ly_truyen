import {
  randomUUID,
} from 'node:crypto';

import bcrypt from 'bcryptjs';

import {
  AccountStatus,
  AuthorApplicationStatus,
  MediaPurpose,
  MediaStatus,
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

const MANAGER_ROLE_CODE =
  'E2E_MANAGER';

async function main():
  Promise<void> {
  assertNotProduction(
    'Preparing admin feature E2E data',
  );

  const [
    userRole,
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
            'ADMIN',
        },
      }),
    ]);

  if (
    !userRole ||
    !adminRole
  ) {
    throw new Error(
      'USER/ADMIN roles chưa được seed. Chạy db:seed trước.',
    );
  }

  const requiredPermissions = [
    'user.manage',

    'role.manage',

    'author-application.review',
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
