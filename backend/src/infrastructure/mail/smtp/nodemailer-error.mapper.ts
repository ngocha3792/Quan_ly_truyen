import { MailDeliveryException } from '../exceptions';

interface NodemailerError extends Error {
  code?: string;
  responseCode?: number;
}

const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNECTION',
  'ECONNRESET',
  'ESOCKET',
  'EDNS',
]);

export function mapNodemailerError(error: unknown): MailDeliveryException {
  const smtpError = error as Partial<NodemailerError>;
  const responseCode = smtpError.responseCode;
  const retryable =
    (smtpError.code ? TRANSIENT_CODES.has(smtpError.code) : false) ||
    responseCode === 421 ||
    (responseCode !== undefined && responseCode >= 450 && responseCode <= 452);

  return new MailDeliveryException(
    'SMTP delivery failed',
    retryable,
    smtpError.code ?? (responseCode ? `SMTP_${responseCode}` : undefined),
    { cause: error },
  );
}
