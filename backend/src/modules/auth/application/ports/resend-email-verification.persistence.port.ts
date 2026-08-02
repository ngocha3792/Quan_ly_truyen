export const RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT = Symbol(
  'AUTH_RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT',
);

export interface ResendEmailVerificationInput {
  email: string;

  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
  expiresInMinutes: number;
}

export type ResendEmailVerificationStatus = 'queued' | 'ignored';

export interface ResendEmailVerificationPersistencePort {
  /**
   * Trả về ignored khi:
   * - tài khoản không tồn tại;
   * - tài khoản đã bị xóa;
   * - email đã được xác minh.
   *
   * Không được ném lỗi khác nhau cho các trạng thái trên.
   */
  execute(
    input: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationStatus>;
}
