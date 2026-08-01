import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CloudinaryWebhookInboxProcessor } from './cloudinary-webhook-inbox.processor';

@Injectable()
export class CloudinaryWebhookInboxWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CloudinaryWebhookInboxWorker.name);
  private timer?: NodeJS.Timeout;
  private activeTick?: Promise<void>;
  private running = false;
  private stopped = false;

  constructor(
    private readonly processor: CloudinaryWebhookInboxProcessor,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const enabled = this.configService.get<boolean>(
      'cloudinary.enabled',
      false,
    );
    const role = this.configService.get<string>('queue.workerRole', 'all');
    if (!enabled || !['all', 'cloudinary-webhook'].includes(role)) {
      this.logger.log(
        'Cloudinary webhook polling disabled for the current worker role',
      );
      return;
    }
    this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    await this.activeTick;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const tick = this.tick();
      this.activeTick = tick;
      void tick.finally(() => {
        if (this.activeTick === tick) {
          this.activeTick = undefined;
        }
      });
    }, delayMs);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    const intervalMs = this.configService.get<number>(
      'cloudinary.webhookPollIntervalMs',
      1000,
    );
    if (this.running) {
      this.schedule(intervalMs);
      return;
    }
    this.running = true;
    try {
      const batchSize = this.configService.get<number>(
        'cloudinary.webhookBatchSize',
        100,
      );
      const summary = await this.processor.processBatch(batchSize);
      if (summary.scanned > 0) {
        this.logger.log({
          message: 'cloudinary webhook inbox batch processed',
          ...summary,
        });
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'cloudinary webhook inbox polling failed',
        failureCategory: 'inbox-poll',
        error: error instanceof Error ? error.message : 'unknown error',
      });
    } finally {
      this.running = false;
      if (!this.stopped) {
        this.schedule(intervalMs);
      }
    }
  }
}
