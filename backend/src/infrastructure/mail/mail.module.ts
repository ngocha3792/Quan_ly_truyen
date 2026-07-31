import { Module } from '@nestjs/common';

import { MailDispatchService, MailHealthService } from './application';
import { MAIL_SENDER } from './contracts';
import { MailProcessor } from './queue';
import {
  NodemailerMailAdapter,
  nodemailerProvider,
  SmtpLifecycleService,
} from './smtp';
import { MailTemplateRegistry, TemplateRendererService } from './templates';

@Module({
  providers: [
    nodemailerProvider,
    { provide: MAIL_SENDER, useClass: NodemailerMailAdapter },
    MailTemplateRegistry,
    TemplateRendererService,
    MailDispatchService,
    MailHealthService,
    MailProcessor,
    SmtpLifecycleService,
  ],
  exports: [MAIL_SENDER, MailDispatchService, MailHealthService],
})
export class MailModule {}
