import { Module } from '@nestjs/common';

import { MailHealthService } from './application';
import { MAIL_SENDER } from './contracts';
import { NodemailerMailAdapter, nodemailerProvider } from './smtp';

@Module({
  providers: [
    nodemailerProvider,
    { provide: MAIL_SENDER, useClass: NodemailerMailAdapter },
    MailHealthService,
  ],
  exports: [MAIL_SENDER, MailHealthService],
})
export class MailTransportModule {}
