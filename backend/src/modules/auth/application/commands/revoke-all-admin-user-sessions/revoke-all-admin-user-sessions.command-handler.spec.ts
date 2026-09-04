import { ResourceNotFoundException } from '@/common/exceptions';

import { RevokeAllAdminUserSessionsCommand } from './revoke-all-admin-user-sessions.command';

import { RevokeAllAdminUserSessionsCommandHandler } from './revoke-all-admin-user-sessions.command-handler';

describe('RevokeAllAdminUserSessionsCommandHandler', () => {
  const actorUserId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    userExists: jest.Mock;

    revokeAllSessions: jest.Mock;
  };

  let handler: RevokeAllAdminUserSessionsCommandHandler;

  beforeEach(() => {
    persistence = {
      userExists: jest.fn(),

      revokeAllSessions: jest.fn(),
    };

    handler = new RevokeAllAdminUserSessionsCommandHandler(
      persistence as never,
    );
  });

  it('revokes every session for an existing user', async () => {
    persistence.userExists.mockResolvedValue(true);

    persistence.revokeAllSessions.mockResolvedValue(3);

    const result = await handler.execute(
      new RevokeAllAdminUserSessionsCommand(actorUserId, userId),
    );

    expect(result).toBe(3);

    expect(persistence.revokeAllSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,

        userId,

        revokedAt: expect.any(Date),
      }),
    );
  });

  it('rejects when the target user does not exist', async () => {
    persistence.userExists.mockResolvedValue(false);

    await expect(
      handler.execute(new RevokeAllAdminUserSessionsCommand(actorUserId, userId)),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(persistence.revokeAllSessions).not.toHaveBeenCalled();
  });
});
