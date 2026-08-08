import { RoleCode } from '@/common/enums';

import { ManagedUserStatus } from '../enums';

export type ManagedUserStatusTransition =
  'unchanged' | 'update' | 'last_active_admin';

export class ManagedUserAdministrationPolicy {
  static isDeleted(status: ManagedUserStatus, deletedAt: Date | null): boolean {
    return deletedAt !== null || status === ManagedUserStatus.DELETED;
  }

  static decideStatusTransition(input: {
    readonly currentStatus: ManagedUserStatus;
    readonly nextStatus: ManagedUserStatus;
    readonly hasActiveAdminRole: boolean;
    readonly activeAdminCount: number;
  }): ManagedUserStatusTransition {
    if (input.currentStatus === input.nextStatus) {
      return 'unchanged';
    }

    const removesAnActiveAdmin =
      input.currentStatus === ManagedUserStatus.ACTIVE &&
      input.nextStatus !== ManagedUserStatus.ACTIVE &&
      input.hasActiveAdminRole;

    return removesAnActiveAdmin && input.activeAdminCount <= 1
      ? 'last_active_admin'
      : 'update';
  }

  static shouldRevokeSessions(nextStatus: ManagedUserStatus): boolean {
    return nextStatus !== ManagedUserStatus.ACTIVE;
  }

  static statusRevocationReason(
    nextStatus: ManagedUserStatus,
  ): 'admin_account_banned' | 'admin_account_suspended' {
    return nextStatus === ManagedUserStatus.BANNED
      ? 'admin_account_banned'
      : 'admin_account_suspended';
  }

  static isDirectlyManageableRole(roleCode: RoleCode): boolean {
    return roleCode === RoleCode.ADMIN;
  }

  static isRoleActive(expiresAt: Date | null | undefined, now: Date): boolean {
    return expiresAt !== undefined && (expiresAt === null || expiresAt > now);
  }

  static wouldRemoveLastActiveAdmin(
    targetStatus: ManagedUserStatus,
    activeAdminCount: number,
  ): boolean {
    return targetStatus === ManagedUserStatus.ACTIVE && activeAdminCount <= 1;
  }
}
