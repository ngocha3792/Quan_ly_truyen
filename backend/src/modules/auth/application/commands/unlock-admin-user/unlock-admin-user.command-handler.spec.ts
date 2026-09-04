import { ResourceNotFoundException } from '@/common/exceptions';

import { UnlockAdminUserCommand } from './unlock-admin-user.command';

import { UnlockAdminUserCommandHandler } from './unlock-admin-user.command-handler';

describe('UnlockAdminUserCommandHandler', () => {
  const actorUserId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    findUnlockIdentity: jest.Mock;

    writeUnlockAuditBestEffort: jest.Mock;
  };

  let limiter: {
    resetAfterSuccess: jest.Mock;
  };

  let handler: UnlockAdminUserCommandHandler;

  beforeEach(() => {
    persistence = {
      findUnlockIdentity: jest.fn(),

      writeUnlockAuditBestEffort: jest.fn().mockResolvedValue(undefined),
    };

    limiter = {
      resetAfterSuccess: jest.fn().mockResolvedValue(undefined),
    };

    handler = new UnlockAdminUserCommandHandler(
      persistence as never,

      limiter as never,
    );
  });

  it('resets login rate limits and records an audit entry', async () => {
    persistence.findUnlockIdentity.mockResolvedValue({
      email: 'user@example.com',

      username: 'user',

      status: 'ACTIVE',
    });

    await handler.execute(new UnlockAdminUserCommand(actorUserId, userId));

    expect(limiter.resetAfterSuccess).toHaveBeenCalledWith({
      identifier: 'user@example.com',
    });

    expect(limiter.resetAfterSuccess).toHaveBeenCalledWith({
      identifier: 'user',
    });

    expect(persistence.writeUnlockAuditBestEffort).toHaveBeenCalledWith({
      actorUserId,

      userId,

      accountStatus: 'ACTIVE',
    });
  });

  it('rejects when the target user does not exist', async () => {
    persistence.findUnlockIdentity.mockResolvedValue(null);

    await expect(
      handler.execute(new UnlockAdminUserCommand(actorUserId, userId)),
    ).rejects.toMatchObject({
      code: 'ADMIN_USER_SECURITY_USER_NOT_FOUND',
    });

    expect(limiter.resetAfterSuccess).not.toHaveBeenCalled();

    expect(persistence.writeUnlockAuditBestEffort).not.toHaveBeenCalled();
  });

  it('propagates ResourceNotFoundException', async () => {
    persistence.findUnlockIdentity.mockResolvedValue(null);

    await expect(
      handler.execute(new UnlockAdminUserCommand(actorUserId, userId)),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });
});
