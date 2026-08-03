import { Module } from '@nestjs/common';

import { MailDispatchService } from './application';

import { MailTransportModule } from './mail-transport.module';

import { MailProcessor } from './queue';

import { MailPayloadSecurityModule } from './security';

import { SmtpLifecycleService } from './smtp';

import { MailTemplateRegistry, TemplateRendererService } from './templates';

@Module({
  imports: [MailTransportModule, MailPayloadSecurityModule],

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
