import { RoleCode } from '@/common/enums';

import { ManagedUserStatus } from '../enums';

import { ManagedUserAdministrationPolicy } from './managed-user-administration.policy';

describe('ManagedUserAdministrationPolicy', () => {
  it('classifies deleted users independently of persistence representation', () => {
    expect(
      ManagedUserAdministrationPolicy.isDeleted(
        ManagedUserStatus.ACTIVE,
        new Date(),
      ),
    ).toBe(true);
    expect(
      ManagedUserAdministrationPolicy.isDeleted(
        ManagedUserStatus.DELETED,
        null,
      ),
    ).toBe(true);
  });

  it('protects the last active admin during status changes', () => {
    expect(
      ManagedUserAdministrationPolicy.decideStatusTransition({
        currentStatus: ManagedUserStatus.ACTIVE,
        nextStatus: ManagedUserStatus.SUSPENDED,
        hasActiveAdminRole: true,
        activeAdminCount: 1,
      }),
    ).toBe('last_active_admin');

    expect(
      ManagedUserAdministrationPolicy.decideStatusTransition({
        currentStatus: ManagedUserStatus.ACTIVE,
        nextStatus: ManagedUserStatus.SUSPENDED,
        hasActiveAdminRole: true,
        activeAdminCount: 2,
      }),
    ).toBe('update');
  });

  it('recognizes no-op transitions and session revocation states', () => {
    expect(
      ManagedUserAdministrationPolicy.decideStatusTransition({
        currentStatus: ManagedUserStatus.BANNED,
        nextStatus: ManagedUserStatus.BANNED,
        hasActiveAdminRole: false,
        activeAdminCount: 0,
      }),
    ).toBe('unchanged');
    expect(
      ManagedUserAdministrationPolicy.shouldRevokeSessions(
        ManagedUserStatus.BANNED,
      ),
    ).toBe(true);
    expect(
      ManagedUserAdministrationPolicy.statusRevocationReason(
        ManagedUserStatus.BANNED,
      ),
    ).toBe('admin_account_banned');
  });

  it('protects role boundaries and the last active admin role', () => {
    expect(
      ManagedUserAdministrationPolicy.isDirectlyManageableRole(RoleCode.ADMIN),
    ).toBe(true);
    expect(
      ManagedUserAdministrationPolicy.isDirectlyManageableRole(RoleCode.AUTHOR),
    ).toBe(false);
    expect(
      ManagedUserAdministrationPolicy.wouldRemoveLastActiveAdmin(
        ManagedUserStatus.ACTIVE,
        1,
      ),
    ).toBe(true);
  });

  it('evaluates expiring role assignments at the supplied clock', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');

    expect(ManagedUserAdministrationPolicy.isRoleActive(null, now)).toBe(true);
    expect(
      ManagedUserAdministrationPolicy.isRoleActive(
        new Date('2026-08-09T00:00:01.000Z'),
        now,
      ),
    ).toBe(true);
    expect(
      ManagedUserAdministrationPolicy.isRoleActive(
        new Date('2026-08-08T23:59:59.000Z'),
        now,
      ),
    ).toBe(false);
    expect(ManagedUserAdministrationPolicy.isRoleActive(undefined, now)).toBe(
      false,
    );
  });
});
