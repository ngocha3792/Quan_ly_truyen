import { RequestEmailChangeCommand } from './request-email-change.command';

import { RequestEmailChangeCommandHandler } from './request-email-change.command-handler';

describe('RequestEmailChangeCommandHandler', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  const rawToken = 'A'.repeat(43);

  let persistence: {
    findCredentialByUserId: jest.Mock;

    request: jest.Mock;
  };

  let passwordHasher: {
    verify: jest.Mock;
  };

  let secureToken: {
    generate: jest.Mock;

    hash: jest.Mock;
  };

  let handler: RequestEmailChangeCommandHandler;

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-03T08:00:00.000Z'));

    persistence = {
      findCredentialByUserId: jest.fn().mockResolvedValue({
        email: 'old@example.com',

        passwordHash: 'password-hash',
      }),

      request: jest.fn().mockResolvedValue({
        status: 'requested',

        currentEmail: 'old@example.com',

        newEmail: 'new@example.com',

        expiresAt: new Date('2026-08-03T08:30:00.000Z'),
      }),
    };

    passwordHasher = {
      verify: jest.fn().mockResolvedValue(true),
    };

    secureToken = {
      generate: jest.fn().mockReturnValue(rawToken),

      hash: jest.fn().mockReturnValue('token-hash'),
    };

    handler = new RequestEmailChangeCommandHandler(
      persistence as never,

      passwordHasher as never,

      secureToken as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a pending email change request', async () => {
    const result = await handler.execute(
      new RequestEmailChangeCommand(
        userId,

        'CurrentPass123!',

        ' New@Example.COM ',
      ),
    );

    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'CurrentPass123!',

      'password-hash',
    );

    expect(secureToken.hash).toHaveBeenCalledWith(rawToken);

    expect(persistence.request).toHaveBeenCalledWith({
      userId,

      expectedCurrentEmail: 'old@example.com',

      expectedPasswordHash: 'password-hash',

      newEmail: 'new@example.com',

      rawToken,

      tokenHash: 'token-hash',

      requestedAt: new Date('2026-08-03T08:00:00.000Z'),

      expiresAt: new Date('2026-08-03T08:30:00.000Z'),

      expiresInMinutes: 30,
    });

    expect(result).toEqual({
      emailChangeRequested: true,

      pendingEmail: 'new@example.com',

      verificationRequired: true,

      expiresAt: new Date('2026-08-03T08:30:00.000Z'),
    });

    expect(JSON.stringify(result)).not.toContain(rawToken);
  });

  it('rejects an incorrect current password', async () => {
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      handler.execute(
        new RequestEmailChangeCommand(
          userId,

          'WrongPass123!',

          'new@example.com',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
    });

    expect(secureToken.generate).not.toHaveBeenCalled();

    expect(persistence.request).not.toHaveBeenCalled();
  });

  it('rejects the current email', async () => {
    await expect(
      handler.execute(
        new RequestEmailChangeCommand(
          userId,

          'CurrentPass123!',

          'OLD@EXAMPLE.COM',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_NEW_EMAIL_MUST_DIFFER',
    });

    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rejects an email already used by another user', async () => {
    persistence.request.mockResolvedValue({
      status: 'email_in_use',

      email: 'new@example.com',
    });

    await expect(
      handler.execute(
        new RequestEmailChangeCommand(
          userId,

          'CurrentPass123!',

          'new@example.com',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
    });
  });

  it('rejects OAuth-only account', async () => {
    persistence.findCredentialByUserId.mockResolvedValue({
      email: 'old@example.com',

      passwordHash: null,
    });

    await expect(
      handler.execute(
        new RequestEmailChangeCommand(
          userId,

          'CurrentPass123!',

          'new@example.com',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_CHANGE_UNAVAILABLE',
    });

    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('does not accept a stale account snapshot', async () => {
    persistence.request.mockResolvedValue({
      status: 'conflict',
    });

    await expect(
      handler.execute(
        new RequestEmailChangeCommand(
          userId,

          'CurrentPass123!',

          'new@example.com',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
    });
  });
});
