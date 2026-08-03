import { ConfirmEmailChangeCommand } from './confirm-email-change.command';

import { ConfirmEmailChangeCommandHandler } from './confirm-email-change.command-handler';

describe('ConfirmEmailChangeCommandHandler', () => {
  const rawToken = 'A'.repeat(43);

  let persistence: {
    confirm: jest.Mock;
  };

  let secureToken: {
    hash: jest.Mock;
  };

  let handler: ConfirmEmailChangeCommandHandler;

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-03T08:15:00.000Z'));

    persistence = {
      confirm: jest.fn().mockResolvedValue({
        status: 'changed',

        previousEmail: 'old@example.com',

        email: 'new@example.com',

        changedAt: new Date('2026-08-03T08:15:00.000Z'),

        sessionsRevoked: 2,
      }),
    };

    secureToken = {
      hash: jest.fn().mockReturnValue('token-hash'),
    };

    handler = new ConfirmEmailChangeCommandHandler(
      persistence as never,

      secureToken as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('confirms an email change', async () => {
    const result = await handler.execute(
      new ConfirmEmailChangeCommand(rawToken),
    );

    expect(persistence.confirm).toHaveBeenCalledWith({
      tokenHash: 'token-hash',

      confirmedAt: new Date('2026-08-03T08:15:00.000Z'),
    });

    expect(result).toEqual({
      emailChanged: true,

      alreadyChanged: false,

      previousEmail: 'old@example.com',

      email: 'new@example.com',

      sessionsRevoked: 2,

      reauthenticationRequired: true,

      changedAt: new Date('2026-08-03T08:15:00.000Z'),
    });
  });

  it('returns an idempotent result when already changed', async () => {
    persistence.confirm.mockResolvedValue({
      status: 'already_changed',

      previousEmail: 'old@example.com',

      email: 'new@example.com',

      changedAt: new Date('2026-08-03T08:15:00.000Z'),

      sessionsRevoked: 0,
    });

    const result = await handler.execute(
      new ConfirmEmailChangeCommand(rawToken),
    );

    expect(result.alreadyChanged).toBe(true);
  });

  it('maps an expired token', async () => {
    persistence.confirm.mockResolvedValue({
      status: 'expired',

      expiresAt: new Date('2026-08-03T08:00:00.000Z'),
    });

    await expect(
      handler.execute(new ConfirmEmailChangeCommand(rawToken)),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_CHANGE_TOKEN_EXPIRED',
    });
  });

  it('maps an invalid token', async () => {
    persistence.confirm.mockResolvedValue({
      status: 'invalid',
    });

    await expect(
      handler.execute(new ConfirmEmailChangeCommand(rawToken)),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_CHANGE_TOKEN_INVALID',
    });
  });

  it('maps a newly occupied email', async () => {
    persistence.confirm.mockResolvedValue({
      status: 'email_in_use',

      email: 'new@example.com',
    });

    await expect(
      handler.execute(new ConfirmEmailChangeCommand(rawToken)),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
    });
  });
});
