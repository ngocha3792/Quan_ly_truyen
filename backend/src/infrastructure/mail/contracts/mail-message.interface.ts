export interface MailAddress {
  name?: string;
  address: string;
}

export interface MailMessage {
  to: MailAddress;
  subject: string;
  text: string;
  html: string;
  messageId?: string;
  replyTo?: MailAddress;
  headers?: Record<string, string>;
  tags?: readonly string[];
  correlationId?: string;
  idempotencyKey?: string;
}
