import type { RoleCode } from '@/common/enums';

import { ManagedUserStatus } from '../enums';

export class ManagedUserRoleEntity {
  constructor(
    readonly code: RoleCode,

    readonly name: string,

    readonly assignedAt: Date,

    readonly expiresAt: Date | null,
  ) {}
}

export interface ManagedUserAvatar {
  readonly id: string;

  readonly url: string | null;
}

export interface ManagedUserAuthorProfile {
  /**
   * AuthorProfile dùng userId làm primary key
   * trong Prisma schema.
   *
   * Response vẫn expose tên id để frontend
   * không phải biết implementation DB.
   */
  readonly id: string;

  readonly penName: string;

  readonly verificationStatus: string;
}

export class ManagedUserSummaryEntity {
  constructor(
    readonly id: string,

    readonly email: string,

    readonly username: string,

    readonly displayName: string,

    readonly status: ManagedUserStatus,

    readonly emailVerifiedAt: Date | null,

    readonly lastLoginAt: Date | null,

    readonly roles: readonly ManagedUserRoleEntity[],

    readonly createdAt: Date,

    readonly updatedAt: Date,
  ) {}
}

export class ManagedUserDetailEntity extends ManagedUserSummaryEntity {
  constructor(
    id: string,

    email: string,

    username: string,

    displayName: string,

    status: ManagedUserStatus,

    emailVerifiedAt: Date | null,

    lastLoginAt: Date | null,

    roles: readonly ManagedUserRoleEntity[],

    createdAt: Date,

    updatedAt: Date,

    readonly bio: string | null,

    readonly avatar: ManagedUserAvatar | null,

    readonly authorProfile: ManagedUserAuthorProfile | null,

    readonly activeSessionCount: number,

    readonly statusReason: string | null,

    readonly mfaEnabled: boolean,

    readonly deletedAt: Date | null,
  ) {
    super(
      id,

      email,

      username,

      displayName,

      status,

      emailVerifiedAt,

      lastLoginAt,

      roles,

      createdAt,

      updatedAt,
    );
  }
}
