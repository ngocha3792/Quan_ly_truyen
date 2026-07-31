export interface MailSendResult {
  messageId: string;
  accepted: readonly string[];
  rejected: readonly string[];
  response?: string;
}
