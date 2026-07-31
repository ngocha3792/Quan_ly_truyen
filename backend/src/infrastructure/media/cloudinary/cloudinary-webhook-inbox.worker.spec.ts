import { ConfigService } from '@nestjs/config';
import { CloudinaryWebhookInboxWorker } from './cloudinary-webhook-inbox.worker';

describe('CloudinaryWebhookInboxWorker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts inbox processing automatically and stops cleanly', async () => {
    const processor = {
      processBatch: jest.fn().mockResolvedValue({
        scanned: 0,
        processed: 0,
        failed: 0,
        skipped: 0,
      }),
    };
    const worker = new CloudinaryWebhookInboxWorker(
      processor as never,
      new ConfigService({
        cloudinary: { webhookPollIntervalMs: 1000, webhookBatchSize: 25 },
      }),
    );
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(processor.processBatch).toHaveBeenCalledWith(25);
    worker.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(2000);
    expect(processor.processBatch).toHaveBeenCalledTimes(1);
  });
});
