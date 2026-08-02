export const LOGIN_RATE_LIMITER_PORT = Symbol('AUTH_LOGIN_RATE_LIMITER_PORT');

export interface LoginRateLimitInput {
  identifier: string;
  ipAddress?: string;
}

export interface LoginRateLimiterPort {
  /**
   * Kiểm tra request có đang bị block không.
   */
  assertAllowed(input: LoginRateLimitInput): Promise<void>;

  /**
   * Ghi nhận một lần đăng nhập thất bại.
   *
   * Có thể ném RateLimitExceededException nếu
   * request vừa đạt ngưỡng.
   */
  recordFailure(input: LoginRateLimitInput): Promise<void>;

  /**
   * Xóa bộ đếm theo identifier sau khi đăng nhập
   * thành công.
   *
   * Không xóa IP counter để tránh kẻ tấn công dùng
   * một credential hợp lệ nhằm reset IP throttle.
   */
  resetAfterSuccess(input: LoginRateLimitInput): Promise<void>;
}
