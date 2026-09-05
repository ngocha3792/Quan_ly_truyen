import { ResourceNotFoundException } from '@/common/exceptions';

import { RevokeAdminUserSessionCommand } from './revoke-admin-user-session.command';

import { RevokeAdminUserSessionCommandHandler } from './revoke-admin-user-session.command-handler';

describe('RevokeAdminUserSessionCommandHandler', () => {
  const actorUserId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const sessionId = '33333333-3333-4333-8333-333333333333';

  let persistence: {
    revokeSession: jest.Mock;
  };

  let handler: RevokeAdminUserSessionCommandHandler;

  beforeEach(() => {
    persistence = {
      revokeSession: jest.fn(),
    };

    handler = new RevokeAdminUserSessionCommandHandler(persistence as never);
  });

  it('revokes the target session', async () => {
    persistence.revokeSession.mockResolvedValue('revoked');

    await handler.execute(
      new RevokeAdminUserSessionCommand(actorUserId, userId, sessionId),
    );

    expect(persistence.revokeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,

        userId,

        sessionId,

        revokedAt: expect.any(Date) as unknown,
      }),
    );
  });

  it('rejects when the session cannot be found', async () => {
    persistence.revokeSession.mockResolvedValue('not_found');

    await expect(
      handler.execute(
        new RevokeAdminUserSessionCommand(actorUserId, userId, sessionId),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });
});
