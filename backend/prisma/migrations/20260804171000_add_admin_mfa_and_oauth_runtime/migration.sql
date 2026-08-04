-- Admin MFA credentials are stored separately from users so the encrypted
-- TOTP secret can be rotated without changing the core user row.
CREATE TABLE "admin_mfa_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "recovery_code_hashes" TEXT[] NOT NULL,
    "last_used_step" BIGINT,
    "enabled_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_mfa_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_mfa_credentials_user_id_key"
    ON "admin_mfa_credentials"("user_id");

ALTER TABLE "admin_mfa_credentials"
    ADD CONSTRAINT "admin_mfa_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions"
    ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(3);
-- A user may link at most one identity from each provider.
CREATE UNIQUE INDEX "oauth_accounts_user_id_provider_key"
    ON "oauth_accounts"("user_id", "provider");
