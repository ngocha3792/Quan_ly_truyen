import { Module } from '@nestjs/common';

import { MailPayloadCipherService } from './mail-payload-cipher.service';

@Module({
  providers: [MailPayloadCipherService],

  exports: [MailPayloadCipherService],
})
export class MailPayloadSecurityModule {}
