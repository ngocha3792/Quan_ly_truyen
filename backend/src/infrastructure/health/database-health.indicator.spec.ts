import { Logger } from '@nestjs/common';

import { DatabaseHealthIndicator } from './database-health.indicator';

describe('DatabaseHealthIndicator', () => {
  it('returns a sanitized down result when Prisma exposes connection details', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
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
      { setDependencyHealth: jest.fn() } as never,
    );

    const result = await indicator.isHealthy();

    expect(result).toEqual({
      database: { status: 'down', message: 'Database unavailable' },
    });
    expect(JSON.stringify(result)).not.toContain('admin:secret');
    expect(JSON.stringify(result)).not.toContain('private-db');
    expect(logError).toHaveBeenCalledWith(
      'Database health check failed',
      expect.stringContaining('postgresql://admin:***@private-db:5432/app'),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('admin:secret');
    logError.mockRestore();
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
