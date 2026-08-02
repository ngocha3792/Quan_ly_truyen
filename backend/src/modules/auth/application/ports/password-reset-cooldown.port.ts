export const PASSWORD_RESET_COOLDOWN_PORT = Symbol(
  'AUTH_PASSWORD_RESET_COOLDOWN_PORT',
);

export interface PasswordResetCooldownPort {
  /**
   * Trả về false nếu email đang trong
   * thời gian cooldown.
   */
  tryAcquire(email: string): Promise<boolean>;

  /**
   * Chỉ gọi khi database/outbox thất bại
   * sau khi đã acquire.
   */
  release(email: string): Promise<void>;
}
