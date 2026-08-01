import { RedisHealthIndicator } from './redis-health.indicator';

describe('RedisHealthIndicator', () => {
  it('returns a sanitized down result when Redis exposes connection details', async () => {
    const redis = {
      ping: jest
        .fn()
        .mockRejectedValue(
          new Error('rediss://default:secret@private-redis:6380'),
        ),
    };
    const indicator = new RedisHealthIndicator(
      redis as never,
      healthIndicatorService() as never,
    );

    const result = await indicator.isHealthy();

    expect(result).toEqual({
      redis: { status: 'down', message: 'Redis unavailable' },
    });
    expect(JSON.stringify(result)).not.toContain('default:secret');
    expect(JSON.stringify(result)).not.toContain('private-redis');
  });

  it('does not echo an unexpected ping response', async () => {
    const indicator = new RedisHealthIndicator(
      { ping: jest.fn().mockResolvedValue('internal-node-name') } as never,
      healthIndicatorService() as never,
    );

    const result = await indicator.isHealthy();

    expect(result).toEqual({
      redis: { status: 'down', message: 'Redis health check failed' },
    });
    expect(JSON.stringify(result)).not.toContain('internal-node-name');
  });
});

function healthIndicatorService() {
  return {
    check: (key: string) => ({
      up: (details: object = {}) => ({
        [key]: { status: 'up', ...details },
      }),
      down: (details: object = {}) => ({
        [key]: { status: 'down', ...details },
      }),
    }),
  };
}
