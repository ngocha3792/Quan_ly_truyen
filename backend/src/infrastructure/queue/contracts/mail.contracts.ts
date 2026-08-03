export const SEND_MAIL_JOB = 'mail.send.v1';

export const MAIL_PAYLOAD_ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;

export interface SendMailJobV1 {
  version: 1;
  templateId: string;
  recipientEmail: string;
  variables: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Payload được lưu trong PostgreSQL outbox và BullMQ/Redis.
 *
 * Không được thêm plaintext mail variables vào envelope này.
 */
export interface EncryptedMailPayloadV1 {
  version: 1;
  algorithm: typeof MAIL_PAYLOAD_ENCRYPTION_ALGORITHM;

  /**
   * Base64 encoded.
   */
  iv: string;

  /**
   * Base64 encoded.
   */
  ciphertext: string;

  /**
   * Base64 encoded AES-GCM authentication tag.
   */
  authTag: string;
}

/**
 * Bao gồm encrypted payload mới và plaintext payload cũ
 * trong giai đoạn chuyển đổi.
 */
export type MailQueuePayload = SendMailJobV1 | EncryptedMailPayloadV1;

export function isEncryptedMailPayloadV1(
  value: unknown,
): value is EncryptedMailPayloadV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<EncryptedMailPayloadV1>;

  return (
    payload.version === 1 &&
    payload.algorithm === MAIL_PAYLOAD_ENCRYPTION_ALGORITHM &&
    typeof payload.iv === 'string' &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.authTag === 'string'
  );
}
