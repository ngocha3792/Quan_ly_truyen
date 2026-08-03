export const JWT_BLACKLIST_PORT = Symbol('AUTH_JWT_BLACKLIST_PORT');

export interface BlacklistAccessTokenInput {
  /**
   * JWT ID của access token.
   *
   * Infrastructure không được lưu tokenId
   * dưới dạng plaintext trong Redis key/value.
   */
  tokenId: string;

  /**
   * Thời điểm hết hạn tuyệt đối của access token.
   *
   * Redis TTL phải được giới hạn đến thời điểm này.
   */
  expiresAt: Date;

  reason: string;
}

export interface JwtBlacklistPort {
  /**
   * Kiểm tra access token đã bị thu hồi hay chưa.
   *
   * Khi blacklist bị disable ngoài production,
   * implementation có thể trả false.
   *
   * Khi blacklist được enable nhưng Redis lỗi,
   * implementation phải tuân theo read failure mode.
   */
  isBlacklisted(tokenId: string): Promise<boolean>;

  /**
   * Thu hồi một access token.
   *
   * Phương thức này KHÔNG ĐƯỢC silently succeed
   * khi blacklist bị disable hoặc Redis ghi thất bại.
   *
   * Nếu token đã hết hạn thì có thể return thành công
   * mà không cần tạo Redis key.
   */
  blacklist(input: BlacklistAccessTokenInput): Promise<void>;
}
