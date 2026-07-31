import { Inject, Injectable } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import type { MailMessage, MailSenderPort, MailSendResult } from '../contracts';
import { MailDeliveryException } from '../exceptions';
import { NODEMAILER_TRANSPORTER } from './nodemailer.constants';
import { mapNodemailerError } from './nodemailer-error.mapper';

@Injectable()
export class NodemailerMailAdapter implements MailSenderPort {
  constructor(
    @Inject(NODEMAILER_TRANSPORTER)
    private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>,
  ) {}

  async verify(): Promise<void> {
    try {
      await this.transporter.verify();
    } catch (error: unknown) {
      throw mapNodemailerError(error);
    }
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    try {
      const result = await this.transporter.sendMail({
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        headers: {
          ...message.headers,
          ...(message.correlationId
            ? { 'X-Correlation-Id': message.correlationId }
            : {}),
        },
      });
      const accepted = result.accepted.map(String);
      const rejected = result.rejected.map(String);
      if (accepted.length === 0) {
        throw new MailDeliveryException('SMTP rejected every recipient', false);
      }
      return {
        messageId: result.messageId,
        accepted,
        rejected,
        response: result.response,
      };
    } catch (error: unknown) {
      if (error instanceof MailDeliveryException) throw error;
      throw mapNodemailerError(error);
    }
  }

  close(): void {
    this.transporter.close();
  }
}
