import { RoleCode } from '@/common/enums';

import {
  ManagedUserDetailEntity,
  ManagedUserRoleProtectedException,
  ManagedUserRoleUnavailableException,
  ManagedUserStatus,
} from '../../../domain';

import { AssignManagedUserRoleCommand } from './assign-managed-user-role.command';

import { AssignManagedUserRoleCommandHandler } from './assign-managed-user-role.command-handler';

describe('AssignManagedUserRoleCommandHandler', () => {
  const actorUserId = '11111111-1111-4111-8111-111111111111';

  const targetUserId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    assignManagedUserRole: jest.Mock;
  };

  let authorizationInvalidation: {
    invalidateUser: jest.Mock;
  };

  let handler: AssignManagedUserRoleCommandHandler;

  beforeEach(() => {
    persistence = {
      assignManagedUserRole: jest.fn(),
    };

    authorizationInvalidation = {
      invalidateUser: jest.fn().mockResolvedValue(undefined),
    };

    handler = new AssignManagedUserRoleCommandHandler(
      persistence as never,

      authorizationInvalidation,
    );
  });

  it('không cho cấp AUTHOR trực tiếp', async () => {
    await expect(
      handler.execute(
        new AssignManagedUserRoleCommand(
          actorUserId,

          targetUserId,

          RoleCode.AUTHOR,
        ),
      ),
    ).rejects.toBeInstanceOf(ManagedUserRoleProtectedException);

    expect(persistence.assignManagedUserRole).not.toHaveBeenCalled();
  });

  it('không cho quản lý USER role trực tiếp', async () => {
    await expect(
      handler.execute(
        new AssignManagedUserRoleCommand(
          actorUserId,

          targetUserId,

          RoleCode.USER,
        ),
      ),
    ).rejects.toBeInstanceOf(ManagedUserRoleProtectedException);
  });

  it('cấp ADMIN và invalidate authorization', async () => {
    persistence.assignManagedUserRole.mockResolvedValue({
      status: 'updated',

      user: createManagedUser(),
    });

    const result = await handler.execute(
      new AssignManagedUserRoleCommand(
        actorUserId,

        targetUserId,

        RoleCode.ADMIN,

        '127.0.0.1',

        'Jest',

        'role-grant-request',
      ),
    );

    expect(persistence.assignManagedUserRole).toHaveBeenCalledWith({
      actorUserId,

      targetUserId,

      roleCode: RoleCode.ADMIN,

      changedAt: expect.any(Date) as unknown,

      audit: {
        ipAddress: '127.0.0.1',

        userAgent: 'Jest',

        requestId: 'role-grant-request',
      },
    });

    expect(authorizationInvalidation.invalidateUser).toHaveBeenCalledWith(
      targetUserId,
    );

    expect(result.id).toBe(targetUserId);
  });

  it('map role_missing thành domain exception', async () => {
    persistence.assignManagedUserRole.mockResolvedValue({
      status: 'role_missing',
    });

    await expect(
      handler.execute(
        new AssignManagedUserRoleCommand(
          actorUserId,

          targetUserId,

          RoleCode.ADMIN,
        ),
      ),
    ).rejects.toBeInstanceOf(ManagedUserRoleUnavailableException);
  });
});

function createManagedUser(): ManagedUserDetailEntity {
  return new ManagedUserDetailEntity(
    '22222222-2222-4222-8222-222222222222',

    'managed@example.test',

    'managed_user',

    'Managed User',

    ManagedUserStatus.ACTIVE,

    new Date(),

    null,

    [],

    new Date(),

    new Date(),

    null,

    null,

    null,

    0,

    null,

    false,

    null,
  );
}
