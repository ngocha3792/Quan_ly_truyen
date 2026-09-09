import { SearchMetricsObserver } from './search-metrics.observer';

describe('SearchMetricsObserver', () => {
  it('exports durable worker failure totals and actual backlog age from the API process', async () => {
    const oldest = new Date('2026-09-09T00:00:00Z');
    const prisma = {
      searchDirtyDocument: {
        findFirst: jest.fn().mockResolvedValue({ changedAt: oldest }),
      },
      searchIndexCheckpoint: {
        findUnique: jest.fn().mockResolvedValue({ failedDocuments: 4 }),
      },
    };
    const metrics = { snapshot: jest.fn() };
    const observer = new SearchMetricsObserver(
      prisma as never,
      metrics as never,
      { isEnabled: () => true } as never,
      {
        enabled: true,
        host: 'http://engine.test',
        apiKey: 'test',
        index: 'search',
      },
    );
    await observer.collect();
    expect(metrics.snapshot).toHaveBeenCalledWith(oldest, 4);
    prisma.searchDirtyDocument.findFirst.mockResolvedValue(null);
    await observer.collect();
    expect(metrics.snapshot).toHaveBeenLastCalledWith(null, 4);
    await observer.onModuleDestroy();
  });
});
