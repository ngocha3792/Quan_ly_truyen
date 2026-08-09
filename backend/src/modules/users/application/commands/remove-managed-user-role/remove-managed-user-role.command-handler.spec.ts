import { RoleCode } from '@/common/enums';

import {
  LastActiveAdminException,
  ManagedUserDetailEntity,
  ManagedUserSelfAdminRoleRemovalException,
  ManagedUserStatus,
} from '../../../domain';

import { RemoveManagedUserRoleCommand } from './remove-managed-user-role.command';

import { RemoveManagedUserRoleCommandHandler } from './remove-managed-user-role.command-handler';

describe('RemoveManagedUserRoleCommandHandler', () => {
  const actorUserId = '11111111-1111-4111-8111-111111111111';

  const targetUserId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    removeManagedUserRole: jest.Mock;
  };

  let authorizationInvalidation: {
    invalidateUser: jest.Mock;
  };

  let handler: RemoveManagedUserRoleCommandHandler;

  beforeEach(() => {
    persistence = {
      removeManagedUserRole: jest.fn(),
    };

    authorizationInvalidation = {
      invalidateUser: jest.fn().mockResolvedValue(undefined),
    };

    handler = new RemoveManagedUserRoleCommandHandler(
      persistence as never,

      authorizationInvalidation,
    );
  });

  it('không cho tự gỡ ADMIN', async () => {
    await expect(
      handler.execute(
        new RemoveManagedUserRoleCommand(
          actorUserId,

          actorUserId,

          RoleCode.ADMIN,
        ),
      ),
    ).rejects.toBeInstanceOf(ManagedUserSelfAdminRoleRemovalException);

    expect(persistence.removeManagedUserRole).not.toHaveBeenCalled();
  });

  it('gỡ ADMIN và invalidate authorization', async () => {
    persistence.removeManagedUserRole.mockResolvedValue({
      status: 'updated',

      user: createManagedUser(),
    });

    await handler.execute(
      new RemoveManagedUserRoleCommand(
        actorUserId,

        targetUserId,

        RoleCode.ADMIN,
      ),
    );

    expect(authorizationInvalidation.invalidateUser).toHaveBeenCalledWith(
      targetUserId,
    );
  });

  it('map last_active_admin thành exception', async () => {
    persistence.removeManagedUserRole.mockResolvedValue({
      status: 'last_active_admin',
    });

    await expect(
      handler.execute(
        new RemoveManagedUserRoleCommand(
          actorUserId,

          targetUserId,

          RoleCode.ADMIN,
        ),
      ),
    ).rejects.toBeInstanceOf(LastActiveAdminException);
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
  );
}
