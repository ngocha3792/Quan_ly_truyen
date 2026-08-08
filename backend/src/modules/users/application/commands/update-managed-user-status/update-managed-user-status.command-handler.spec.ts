import {
  LastActiveAdminException,
  ManagedUserDetailEntity,
  ManagedUserSelfStatusChangeException,
  ManagedUserStatus,
  ManagedUserStatusNotManageableException,
} from '../../../domain';

import { UpdateManagedUserStatusCommand } from './update-managed-user-status.command';

import { UpdateManagedUserStatusCommandHandler } from './update-managed-user-status.command-handler';

describe('UpdateManagedUserStatusCommandHandler', () => {
  const actorUserId = '11111111-1111-4111-8111-111111111111';

  const targetUserId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    updateManagedUserStatus: jest.Mock;
  };

  let authorizationInvalidation: {
    invalidateUser: jest.Mock;
  };

  let handler: UpdateManagedUserStatusCommandHandler;

  beforeEach(() => {
    persistence = {
      updateManagedUserStatus: jest.fn(),
    };

    authorizationInvalidation = {
      invalidateUser: jest.fn().mockResolvedValue(undefined),
    };

    handler = new UpdateManagedUserStatusCommandHandler(
      persistence as never,

      authorizationInvalidation as never,
    );
  });

  it('không cho admin thay đổi status của chính mình', async () => {
    await expect(
      handler.execute(
        new UpdateManagedUserStatusCommand(
          actorUserId,

          actorUserId,

          ManagedUserStatus.SUSPENDED,
        ),
      ),
    ).rejects.toBeInstanceOf(ManagedUserSelfStatusChangeException);

    expect(persistence.updateManagedUserStatus).not.toHaveBeenCalled();
  });

  it('không cho chuyển sang DELETED từ User Management', async () => {
    await expect(
      handler.execute(
        new UpdateManagedUserStatusCommand(
          actorUserId,

          targetUserId,

          ManagedUserStatus.DELETED,
        ),
      ),
    ).rejects.toBeInstanceOf(ManagedUserStatusNotManageableException);

    expect(persistence.updateManagedUserStatus).not.toHaveBeenCalled();
  });

  it('invalidate authorization sau khi status thay đổi', async () => {
    persistence.updateManagedUserStatus.mockResolvedValue({
      status: 'updated',

      user: createManagedUser({
        status: ManagedUserStatus.SUSPENDED,
      }),
    });

    const result = await handler.execute(
      new UpdateManagedUserStatusCommand(
        actorUserId,

        targetUserId,

        ManagedUserStatus.SUSPENDED,

        '127.0.0.1',

        'Jest',

        'request-1',
      ),
    );

    expect(persistence.updateManagedUserStatus).toHaveBeenCalledWith({
      actorUserId,

      targetUserId,

      status: ManagedUserStatus.SUSPENDED,

      changedAt: expect.any(Date),

      audit: {
        ipAddress: '127.0.0.1',

        userAgent: 'Jest',

        requestId: 'request-1',
      },
    });

    expect(authorizationInvalidation.invalidateUser).toHaveBeenCalledWith(
      targetUserId,
    );

    expect(result.status).toBe(ManagedUserStatus.SUSPENDED);
  });

  it('không invalidate nếu status không đổi', async () => {
    persistence.updateManagedUserStatus.mockResolvedValue({
      status: 'unchanged',

      user: createManagedUser(),
    });

    await handler.execute(
      new UpdateManagedUserStatusCommand(
        actorUserId,

        targetUserId,

        ManagedUserStatus.ACTIVE,
      ),
    );

    expect(authorizationInvalidation.invalidateUser).not.toHaveBeenCalled();
  });

  it('map last_active_admin thành domain exception', async () => {
    persistence.updateManagedUserStatus.mockResolvedValue({
      status: 'last_active_admin',
    });

    await expect(
      handler.execute(
        new UpdateManagedUserStatusCommand(
          actorUserId,

          targetUserId,

          ManagedUserStatus.SUSPENDED,
        ),
      ),
    ).rejects.toBeInstanceOf(LastActiveAdminException);
  });
});

function createManagedUser(
  overrides: {
    status?: ManagedUserStatus;
  } = {},
): ManagedUserDetailEntity {
  return new ManagedUserDetailEntity(
    '22222222-2222-4222-8222-222222222222',

    'managed@example.test',

    'managed_user',

    'Managed User',

    overrides.status ?? ManagedUserStatus.ACTIVE,

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
