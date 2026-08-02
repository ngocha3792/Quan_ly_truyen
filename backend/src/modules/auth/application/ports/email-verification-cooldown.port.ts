export const EMAIL_VERIFICATION_COOLDOWN_PORT = Symbol(
  'AUTH_EMAIL_VERIFICATION_COOLDOWN_PORT',
);

export interface EmailVerificationCooldownPort {
  /**
   * Trả về true nếu request này giành được cooldown.
   *
   * Trả về false nếu email đang trong thời gian cooldown.
   */
  tryAcquire(email: string): Promise<boolean>;

  /**
   * Chỉ dùng khi database/outbox bị lỗi sau khi đã acquire.
   */
  release(email: string): Promise<void>;
}
