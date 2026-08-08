export type ManagedUserStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETED';

export type ManagedUserStatusFilter =
  | 'ALL'
  | ManagedUserStatus;

export type ManagedUserRoleCode =
  | 'USER'
  | 'AUTHOR'
  | 'ADMIN';

export type ManagedUserRoleFilter =
  | 'ALL'
  | ManagedUserRoleCode;

export interface ManagedUserRole {
  readonly code:
    ManagedUserRoleCode;

  readonly name:
    string;

  readonly assignedAt:
    string;

  readonly expiresAt:
    string | null;
}

export interface AdminUserSummary {
  readonly id:
    string;

  readonly email:
    string;

  readonly username:
    string;

  readonly displayName:
    string;

  readonly status:
    ManagedUserStatus;

  readonly emailVerified:
    boolean;

  readonly emailVerifiedAt:
    string | null;

  readonly lastLoginAt:
    string | null;

  readonly roles:
    readonly ManagedUserRole[];

  readonly createdAt:
    string;

  readonly updatedAt:
    string;
}

export interface AdminUserDetail
  extends AdminUserSummary {
  readonly bio:
    string | null;

  readonly avatar: {
    readonly id:
      string;

    readonly url:
      string | null;
  } | null;

  readonly authorProfile: {
    readonly id:
      string;

    readonly penName:
      string;

    readonly verificationStatus:
      string;
  } | null;

  readonly activeSessionCount:
    number;

  readonly deletedAt:
    string | null;
}

export interface AdminUserListResponse {
  readonly total:
    number;

  readonly users:
    readonly AdminUserSummary[];
}
