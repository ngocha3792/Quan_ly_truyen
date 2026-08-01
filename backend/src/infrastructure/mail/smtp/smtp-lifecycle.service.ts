import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MailConfig } from '@/config';

import { MAIL_SENDER, type MailSenderPort } from '../contracts';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class SmtpLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmtpLifecycleService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(MAIL_SENDER) private readonly sender: MailSenderPort,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = this.configService.getOrThrow<MailConfig>('mail');
    if (!config.enabled) {
      this.metrics.recordSmtpVerify('disabled');
      this.metrics.setDependencyHealth('mail', 'disabled');
      this.logger.log({ event: 'mail.smtp.disabled' });
      return;
    }
    if (config.smtp.verifyOnStartup) {
      try {
        await this.sender.verify();
        this.metrics.recordSmtpVerify('success');
        this.metrics.setDependencyHealth('mail', 'up');
        this.logger.log({ event: 'mail.smtp.verified' });
      } catch (error: unknown) {
        this.metrics.recordSmtpVerify('failed');
        this.metrics.setDependencyHealth('mail', 'down');
        throw error;
      }
    } else {
      this.metrics.setDependencyHealth('mail', 'configured');
    }
  }

  onModuleDestroy(): void {
    this.sender.close();
  }
}
