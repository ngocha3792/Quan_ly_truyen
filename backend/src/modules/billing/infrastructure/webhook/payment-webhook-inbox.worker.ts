import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { billingConfig, monetizationConfig } from '@/config';

import { PaymentWebhookInboxProcessor } from './payment-webhook-inbox.processor';

@Injectable()
export class PaymentWebhookInboxWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PaymentWebhookInboxWorker.name);
  private timer?: NodeJS.Timeout;
  private activeTick?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly processor: PaymentWebhookInboxProcessor,
    @Inject(billingConfig.KEY)
    private readonly billing: ConfigType<typeof billingConfig>,
    @Inject(monetizationConfig.KEY)
    private readonly monetization: ConfigType<typeof monetizationConfig>,
  ) {}

  onApplicationBootstrap(): void {
    if (
      !this.monetization.paymentProviderEnabled ||
      this.billing.providerMode === 'disabled'
    ) {
      this.logger.log('Payment webhook polling disabled');
      return;
    }
    this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.activeTick;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      const tick = this.tick();
      this.activeTick = tick;
      void tick.finally(() => {
        if (this.activeTick === tick) this.activeTick = undefined;
      });
    }, delayMs);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    try {
      const summary = await this.processor.processBatch();
      if (summary.scanned > 0)
        this.logger.log({ event: 'payment.webhook.batch', ...summary });
    } catch (error: unknown) {
      this.logger.error({
        event: 'payment.webhook.poll.failed',
        error: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.schedule(this.billing.webhookPollIntervalMs);
    }
  }
}
