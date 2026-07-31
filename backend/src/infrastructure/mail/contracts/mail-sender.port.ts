import type { MailMessage } from './mail-message.interface';
import type { MailSendResult } from './mail-send-result.interface';

export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailSenderPort {
  verify(): Promise<void>;
  send(message: MailMessage): Promise<MailSendResult>;
  close(): void;
}
