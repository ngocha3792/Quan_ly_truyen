import type {
  ManagedUserDetailResultDto,
  ManagedUserListResultDto,
  ManagedUserSummaryResultDto,
} from '../../../application';

export interface ManagedUserRoleResponse {
  readonly code: string;
  readonly name: string;
  readonly assignedAt: string;
  readonly expiresAt: string | null;
}

export interface ManagedUserSummaryResponse {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly displayName: string;
  readonly status: string;
  readonly emailVerified: boolean;
  readonly emailVerifiedAt: string | null;
  readonly lastLoginAt: string | null;
  readonly roles: readonly ManagedUserRoleResponse[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ManagedUserDetailResponse extends ManagedUserSummaryResponse {
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
  readonly deletedAt: string | null;
}

export interface ManagedUserListResponse {
  readonly total: number;
  readonly users: readonly ManagedUserSummaryResponse[];
}

export function toManagedUserSummaryResponse(
  result: ManagedUserSummaryResultDto,
): ManagedUserSummaryResponse {
  return {
    id: result.id,
    email: result.email,
    username: result.username,
    displayName: result.displayName,
    status: result.status,
    emailVerified: result.emailVerified,
    emailVerifiedAt: result.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: result.lastLoginAt?.toISOString() ?? null,
    roles: result.roles.map((role) => ({
      code: role.code,
      name: role.name,
      assignedAt: role.assignedAt.toISOString(),
      expiresAt: role.expiresAt?.toISOString() ?? null,
    })),
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

export function toManagedUserDetailResponse(
  result: ManagedUserDetailResultDto,
): ManagedUserDetailResponse {
  return {
    ...toManagedUserSummaryResponse(result),
    bio: result.bio,
    avatar: result.avatar,
    authorProfile: result.authorProfile,
    activeSessionCount: result.activeSessionCount,
    statusReason: result.statusReason,
    mfaEnabled: result.mfaEnabled,
    deletedAt: result.deletedAt?.toISOString() ?? null,
  };
}

export function toManagedUserListResponse(
  result: ManagedUserListResultDto,
): ManagedUserListResponse {
  return {
    total: result.total,
    users: result.users.map(toManagedUserSummaryResponse),
  };
}
