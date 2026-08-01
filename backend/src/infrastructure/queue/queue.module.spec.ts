import type { QueueConfig, RedisConfig } from '@/config';

import { createBullQueueOptions } from './queue.module';

describe('createBullQueueOptions', () => {
  it('keeps the BullMQ prefix separate and supports rediss database/TLS', () => {
    const queue = {
      prefix: 'jobs',
      defaultAttempts: 3,
      defaultBackoffMs: 5000,
    } as QueueConfig;
    const redis = {
      url: 'rediss://user:pass@example.com:6380/2',
      keyPrefix: 'app-data',
      connectTimeoutMs: 4321,
    } as RedisConfig;
    const options = createBullQueueOptions(queue, redis);
    expect(options.prefix).toBe('jobs');
    expect(options.connection).toEqual(
      expect.objectContaining({
        host: 'example.com',
        port: 6380,
        db: 2,
        tls: { servername: 'example.com' },
        connectTimeout: 4321,
        maxRetriesPerRequest: null,
      }),
    );
    expect(options.connection).not.toHaveProperty('keyPrefix');
  });
});
