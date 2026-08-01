import { REDACTED_LOG_VALUE } from './logging.constants';
import { sanitizeLogValue } from './log-sanitizer';

describe('sanitizeLogValue', () => {
  it('redacts nested secrets without mutating the input', () => {
    const input = {
      profile: { name: 'Reader', password: 'secret' },
      authorization: 'Bearer token',
      smtp: { credential: 'smtp-password' },
    };

    expect(sanitizeLogValue(input)).toEqual({
      profile: { name: 'Reader', password: REDACTED_LOG_VALUE },
      authorization: REDACTED_LOG_VALUE,
      smtp: { credential: REDACTED_LOG_VALUE },
    });
    expect(input.profile.password).toBe('secret');
  });

  it('sanitizes URL credentials and signed query values', () => {
    const result = sanitizeLogValue({
      database: 'postgresql://reader:db-secret@db.internal/app',
      redis: 'rediss://worker:redis-secret@redis.internal:6380',
      smtp: 'smtp://mailer:mail-secret@mail.internal:587',
      media:
        'https://res.cloudinary.com/demo/image/upload/x?signature=secret&auth_token=token',
    });

    expect(JSON.stringify(result)).not.toMatch(
      /db-secret|redis-secret|mail-secret|signature=secret|auth_token=token/,
    );
  });

  it('handles circular objects and bounded depth without throwing', () => {
    const input: Record<string, unknown> = { value: 'ok' };
    input.self = input;

    expect(sanitizeLogValue(input)).toEqual({
      value: 'ok',
      self: '[CIRCULAR]',
    });
  });
});
