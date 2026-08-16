import type { RoleCode } from '@/common/enums';

import type { ManagedUserStatus } from '../../domain';

export interface ManagedUserRoleResultDto {
  readonly code: RoleCode;

  readonly name: string;

  readonly assignedAt: Date;

  readonly expiresAt: Date | null;
}

export interface ManagedUserSummaryResultDto {
  readonly id: string;

  readonly email: string;

  readonly username: string;

  readonly displayName: string;

  readonly status: ManagedUserStatus;

  readonly emailVerified: boolean;

  readonly emailVerifiedAt: Date | null;

  readonly lastLoginAt: Date | null;

  readonly roles: readonly ManagedUserRoleResultDto[];

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface ManagedUserDetailResultDto extends ManagedUserSummaryResultDto {
  readonly bio: string | null;

  readonly avatar: {
    readonly id: string;

    readonly url: string | null;
  } | null;

  readonly authorProfile: {
    readonly id: string;

    readonly penName: string;

    readonly verificationStatus: string;
  } | null;

  readonly activeSessionCount: number;

  readonly statusReason: string | null;

  readonly mfaEnabled: boolean;

  readonly deletedAt: Date | null;
}

export interface ManagedUserListResultDto {
  readonly total: number;

  readonly users: readonly ManagedUserSummaryResultDto[];
}
