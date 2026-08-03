import { ChangePasswordCommand } from './change-password.command';

import { ChangePasswordCommandHandler } from './change-password.command-handler';

describe('ChangePasswordCommandHandler', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  const sessionId = '22222222-2222-4222-8222-222222222222';

  let persistence: {
    findCredentialByUserId: jest.Mock;

    changePassword: jest.Mock;
  };

  let passwordHasher: {
    verify: jest.Mock;

    hash: jest.Mock;
  };

  let handler: ChangePasswordCommandHandler;

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-03T07:00:00.000Z'));

    persistence = {
      findCredentialByUserId: jest.fn().mockResolvedValue({
        passwordHash: 'current-password-hash',
      }),

      changePassword: jest.fn().mockResolvedValue({
        status: 'changed',

        otherSessionsRevoked: 2,

        changedAt: new Date('2026-08-03T07:00:00.000Z'),
      }),
    };

    passwordHasher = {
      verify: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),

      hash: jest.fn().mockResolvedValue('next-password-hash'),
    };

    handler = new ChangePasswordCommandHandler(
      persistence,

      passwordHasher,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('changes password and revokes other sessions', async () => {
    const result = await handler.execute(
      new ChangePasswordCommand(
        userId,

        sessionId,

        'CurrentPass123!',

        'NextStrongPass123!',
      ),
    );

    expect(persistence.findCredentialByUserId).toHaveBeenCalledWith(userId);

    expect(passwordHasher.verify).toHaveBeenNthCalledWith(
      1,

      'CurrentPass123!',

      'current-password-hash',
    );

    expect(passwordHasher.verify).toHaveBeenNthCalledWith(
      2,

      'NextStrongPass123!',

      'current-password-hash',
    );

    expect(passwordHasher.hash).toHaveBeenCalledWith('NextStrongPass123!');

    expect(persistence.changePassword).toHaveBeenCalledWith({
      userId,

      currentSessionId: sessionId,

      expectedPasswordHash: 'current-password-hash',

      nextPasswordHash: 'next-password-hash',

      changedAt: new Date('2026-08-03T07:00:00.000Z'),
    });

    expect(result).toEqual({
      passwordChanged: true,

      otherSessionsRevoked: 2,

      currentSessionKept: true,

      accessTokenInvalidated: true,

      refreshRequired: true,

      changedAt: new Date('2026-08-03T07:00:00.000Z'),
    });
  });

  it('rejects an incorrect current password', async () => {
    passwordHasher.verify.mockReset().mockResolvedValue(false);

    await expect(
      handler.execute(
        new ChangePasswordCommand(
          userId,

          sessionId,

          'WrongPass123!',

          'NextStrongPass123!',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();

    expect(persistence.changePassword).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    passwordHasher.verify
      .mockReset()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      handler.execute(
        new ChangePasswordCommand(
          userId,

          sessionId,

          'CurrentPass123!',

          'CurrentPass123!',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_NEW_PASSWORD_MUST_DIFFER',
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();

    expect(persistence.changePassword).not.toHaveBeenCalled();
  });

  it('rejects OAuth-only account without local password', async () => {
    persistence.findCredentialByUserId.mockResolvedValue({
      passwordHash: null,
    });

    await expect(
      handler.execute(
        new ChangePasswordCommand(
          userId,

          sessionId,

          'CurrentPass123!',

          'NextStrongPass123!',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_PASSWORD_CHANGE_UNAVAILABLE',
    });

    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rejects an unavailable current session', async () => {
    persistence.changePassword.mockResolvedValue({
      status: 'current_session_unavailable',
    });

    await expect(
      handler.execute(
        new ChangePasswordCommand(
          userId,

          sessionId,

          'CurrentPass123!',

          'NextStrongPass123!',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_SESSION_UNAVAILABLE',
    });
  });

  it('maps a concurrent password change to invalid current password', async () => {
    persistence.changePassword.mockResolvedValue({
      status: 'conflict',
    });

    await expect(
      handler.execute(
        new ChangePasswordCommand(
          userId,

          sessionId,

          'CurrentPass123!',

          'NextStrongPass123!',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
    });
  });

  it('rejects missing authentication metadata', async () => {
    await expect(
      handler.execute(
        new ChangePasswordCommand(
          undefined,

          undefined,

          'CurrentPass123!',

          'NextStrongPass123!',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_SESSION_REQUIRED',
    });

    expect(persistence.findCredentialByUserId).not.toHaveBeenCalled();
  });
});
