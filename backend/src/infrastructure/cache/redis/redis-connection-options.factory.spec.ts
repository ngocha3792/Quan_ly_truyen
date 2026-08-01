import { createRedisConnectionOptions } from './redis-connection-options.factory';

describe('createRedisConnectionOptions', () => {
  it('parses redis URLs including the database', () => {
    expect(createRedisConnectionOptions('redis://localhost:6379/3')).toEqual(
      expect.objectContaining({ host: 'localhost', port: 6379, db: 3 }),
    );
  });

  it('decodes credentials without exposing them in errors', () => {
    const options = createRedisConnectionOptions(
      'redis://user%40tenant:p%40ss@example.com:6380/2',
    );
    expect(options).toEqual(
      expect.objectContaining({
        host: 'example.com',
        username: 'user@tenant',
        password: 'p@ss',
        port: 6380,
        db: 2,
      }),
    );
  });

  it('enables TLS for rediss URLs and keeps BullMQ overrides', () => {
    const options = createRedisConnectionOptions(
      'rediss://user:secret@example.com:6380/2',
      { maxRetriesPerRequest: null },
    );
    expect(options.tls).toEqual({ servername: 'example.com' });
    expect(options.maxRetriesPerRequest).toBeNull();
  });

  it('rejects unsupported protocols without echoing credentials', () => {
    expect(() =>
      createRedisConnectionOptions('http://user:secret@example.com'),
    ).toThrow('protocol must be redis:// or rediss://');
    try {
      createRedisConnectionOptions('http://user:secret@example.com');
    } catch (error: unknown) {
      expect(String(error)).not.toContain('secret');
    }
  });
});
