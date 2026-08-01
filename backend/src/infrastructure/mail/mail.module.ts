import { Module } from '@nestjs/common';

import { MailDispatchService } from './application';
import { MailProcessor } from './queue';
import { SmtpLifecycleService } from './smtp';
import { MailTemplateRegistry, TemplateRendererService } from './templates';
import { MailTransportModule } from './mail-transport.module';

@Module({
  imports: [MailTransportModule],
  providers: [
    MailTemplateRegistry,
    TemplateRendererService,
    MailDispatchService,
    MailProcessor,
    SmtpLifecycleService,
  ],
  exports: [MailTransportModule, MailDispatchService],
})
export class MailModule {}
