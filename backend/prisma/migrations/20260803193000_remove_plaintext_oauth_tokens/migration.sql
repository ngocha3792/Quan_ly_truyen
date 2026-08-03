/*
 * OAuth chưa được triển khai trong runtime.
 *
 * Không giữ sẵn các cột có thể lưu provider credential
 * dưới dạng plaintext.
 */
ALTER TABLE "oauth_accounts"
  DROP COLUMN IF EXISTS "access_token",
  DROP COLUMN IF EXISTS "refresh_token";