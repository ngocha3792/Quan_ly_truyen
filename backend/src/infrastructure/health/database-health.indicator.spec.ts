import { DatabaseHealthIndicator } from './database-health.indicator';

describe('DatabaseHealthIndicator', () => {
  it('returns a sanitized down result when Prisma exposes connection details', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(
          new Error('postgresql://admin:secret@private-db:5432/app'),
        ),
    };
    const indicator = new DatabaseHealthIndicator(
      prisma as never,
      healthIndicatorService() as never,
    );

    const result = await indicator.isHealthy();

    expect(result).toEqual({
      database: { status: 'down', message: 'Database unavailable' },
    });
    expect(JSON.stringify(result)).not.toContain('admin:secret');
    expect(JSON.stringify(result)).not.toContain('private-db');
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
