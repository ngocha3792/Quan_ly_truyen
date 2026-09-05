import { AuthenticationRequiredException } from '@/common/exceptions';

import { SetCurrentSessionTrustCommand } from './set-current-session-trust.command';

import { SetCurrentSessionTrustCommandHandler } from './set-current-session-trust.command-handler';

describe('SetCurrentSessionTrustCommandHandler', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  const sessionId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    setCurrentSessionTrusted: jest.Mock;
  };

  let handler: SetCurrentSessionTrustCommandHandler;

  beforeEach(() => {
    persistence = {
      setCurrentSessionTrusted: jest.fn(),
    };

    handler = new SetCurrentSessionTrustCommandHandler(persistence as never);
  });

  it('marks the current session as trusted', async () => {
    persistence.setCurrentSessionTrusted.mockResolvedValue(true);

    await handler.execute(
      new SetCurrentSessionTrustCommand(userId, sessionId, true),
    );

    expect(persistence.setCurrentSessionTrusted).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,

        sessionId,

        trusted: true,

        changedAt: expect.any(Date) as unknown,
      }),
    );
  });

  it('rejects when the caller has no authenticated principal', async () => {
    await expect(
      handler.execute(
        new SetCurrentSessionTrustCommand(undefined, undefined, true),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.setCurrentSessionTrusted).not.toHaveBeenCalled();
  });

  it('rejects when the current session is no longer active', async () => {
    persistence.setCurrentSessionTrusted.mockResolvedValue(false);

    await expect(
      handler.execute(
        new SetCurrentSessionTrustCommand(userId, sessionId, false),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_SESSION_NOT_ACTIVE',
    });
  });
});
