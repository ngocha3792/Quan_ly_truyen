export const SEND_MAIL_JOB = 'mail.send.v1';

export interface SendMailJobV1 {
  version: 1;
  templateId: string;
  recipientEmail: string;
  variables: Record<string, unknown>;
  correlationId?: string;
}
