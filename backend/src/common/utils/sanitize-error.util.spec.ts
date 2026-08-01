import {
  sanitizeCredentialUrls,
  sanitizeErrorForLog,
} from './sanitize-error.util';

describe('sanitizeErrorForLog', () => {
  it.each([
    [
      'postgresql://reader:db-secret@db.internal:5432/app',
      'postgresql://reader:***@db.internal:5432/app',
    ],
    [
      'postgres://reader:db-secret@db.internal/app',
      'postgres://reader:***@db.internal/app',
    ],
    [
      'redis://default:redis-secret@redis.internal:6379',
      'redis://default:***@redis.internal:6379',
    ],
    [
      'rediss://worker:tls-secret@redis.internal:6380',
      'rediss://worker:***@redis.internal:6380',
    ],
    [
      'postgresql://reader:p%40ss%3Aword@db.internal/app',
      'postgresql://reader:***@db.internal/app',
    ],
    [
      'redis://host/0?password=secret&token=abc&api_key=xyz',
      'redis://host/0?password=***&token=***&api_key=***',
    ],
    [
      'smtp://mailer:smtp-secret@mail.internal:587',
      'smtp://mailer:***@mail.internal:587',
    ],
    [
      'https://res.cloudinary.com/a/image/upload/x?signature=signed-secret&auth_token=abc',
      'https://res.cloudinary.com/a/image/upload/x?signature=***&auth_token=***',
    ],
  ])('redacts credentials in %s', (raw, expected) => {
    expect(sanitizeCredentialUrls(raw)).toBe(expected);
  });

  it('redacts bearer tokens and JWT-shaped values', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature';
    const sanitized = sanitizeCredentialUrls(`Bearer secret-token ${jwt}`);

    expect(sanitized).toBe('Bearer *** [REDACTED_JWT]');
  });

  it('preserves a normal error and its class information', () => {
    const error = new TypeError('connection timed out');
    expect(sanitizeErrorForLog(error)).toContain(
      'TypeError: connection timed out',
    );
  });

  it('sanitizes credentials embedded in an error stack', () => {
    const error = new Error(
      'failed at rediss://default:secret@redis.internal:6380',
    );
    const sanitized = sanitizeErrorForLog(error);

    expect(sanitized).toContain('rediss://default:***@redis.internal:6380');
    expect(sanitized).not.toContain('secret');
  });
});
