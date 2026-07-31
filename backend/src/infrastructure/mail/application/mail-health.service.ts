import { Inject, Injectable } from '@nestjs/common';

import { MAIL_SENDER, type MailSenderPort } from '../contracts';

@Injectable()
export class MailHealthService {
  constructor(@Inject(MAIL_SENDER) private readonly sender: MailSenderPort) {}
  verify(): Promise<void> {
    return this.sender.verify();
  }
}
