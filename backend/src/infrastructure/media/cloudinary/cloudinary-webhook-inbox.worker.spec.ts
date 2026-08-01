import { ConfigService } from '@nestjs/config';

import { CloudinaryWebhookInboxWorker } from './cloudinary-webhook-inbox.worker';

describe('CloudinaryWebhookInboxWorker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('completes shutdown immediately before any tick starts', async () => {
    const processor = { processBatch: jest.fn() };
    const worker = createWorker(processor);

    await expect(worker.onApplicationShutdown()).resolves.toBeUndefined();
    expect(processor.processBatch).not.toHaveBeenCalled();
  });

  it('waits for the active batch before shutdown completes', async () => {
    const batch = deferred<BatchSummary>();
    const processor = {
      processBatch: jest.fn().mockReturnValue(batch.promise),
    };
    const worker = createWorker(processor);
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);

    let shutdownComplete = false;
    const shutdown = worker.onApplicationShutdown().then(() => {
      shutdownComplete = true;
    });
    await Promise.resolve();
    expect(shutdownComplete).toBe(false);

    batch.resolve(emptySummary());
    await shutdown;
    expect(shutdownComplete).toBe(true);
  });

  it('does not schedule another tick after shutdown', async () => {
    const processor = {
      processBatch: jest.fn().mockResolvedValue(emptySummary()),
    };
    const worker = createWorker(processor);
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    await worker.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(5000);
    expect(processor.processBatch).toHaveBeenCalledTimes(1);
  });

  it('handles a rejected batch without an unhandled rejection or reschedule after shutdown', async () => {
    const processor = {
      processBatch: jest.fn().mockRejectedValue(new Error('batch failed')),
    };
    const worker = createWorker(processor);
    worker.onApplicationBootstrap();

    await expect(jest.advanceTimersByTimeAsync(0)).resolves.toBeUndefined();
    await expect(worker.onApplicationShutdown()).resolves.toBeUndefined();
    await jest.advanceTimersByTimeAsync(5000);
    expect(processor.processBatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Cloudinary is disabled', false, 'all'],
    ['the worker is queue-only', true, 'queue'],
  ])('does not poll when %s', async (_case, enabled, role) => {
    const processor = { processBatch: jest.fn() };
    const worker = createWorker(processor, enabled, role);
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(2000);
    expect(processor.processBatch).not.toHaveBeenCalled();
    await worker.onApplicationShutdown();
  });
});

interface BatchSummary {
  scanned: number;
  processed: number;
  failed: number;
  skipped: number;
}

function emptySummary(): BatchSummary {
  return { scanned: 0, processed: 0, failed: 0, skipped: 0 };
}

function createWorker(
  processor: { processBatch: jest.Mock },
  enabled = true,
  workerRole = 'all',
): CloudinaryWebhookInboxWorker {
  return new CloudinaryWebhookInboxWorker(
    processor as never,
    new ConfigService({
      cloudinary: {
        enabled,
        webhookPollIntervalMs: 1000,
        webhookBatchSize: 25,
      },
      queue: { workerRole },
    }),
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
