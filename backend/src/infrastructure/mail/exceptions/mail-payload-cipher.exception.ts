export type MailPayloadCipherErrorCode =
  | 'MAIL_PAYLOAD_ENCRYPTION_KEY_MISSING'
  | 'MAIL_PAYLOAD_ENCRYPTION_KEY_INVALID'
  | 'MAIL_PAYLOAD_ENCRYPTION_FAILED'
  | 'MAIL_PAYLOAD_DECRYPTION_FAILED'
  | 'MAIL_PAYLOAD_ENVELOPE_INVALID';

export class MailPayloadCipherException extends Error {
  constructor(readonly code: MailPayloadCipherErrorCode) {
    /*
     * Chỉ dùng error code cố định.
     * Không đưa plaintext, token, URL hoặc ciphertext
     * vào error message.
     */
    super(code);

    this.name = MailPayloadCipherException.name;
  }
}
