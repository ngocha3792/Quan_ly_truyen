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

@Injectable()
export class SmtpLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmtpLifecycleService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(MAIL_SENDER) private readonly sender: MailSenderPort,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = this.configService.getOrThrow<MailConfig>('mail');
    if (!config.enabled) {
      this.logger.log('Mail delivery disabled (MAIL_ENABLED=false)');
      return;
    }
    if (config.smtp.verifyOnStartup) {
      await this.sender.verify();
      this.logger.log('SMTP connection verified');
    }
  }

  onModuleDestroy(): void {
    this.sender.close();
  }
}
