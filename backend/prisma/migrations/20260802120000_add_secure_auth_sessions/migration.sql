ALTER TABLE "sessions"
ADD COLUMN "refresh_token_family_id" UUID,
ADD COLUMN "refresh_token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "access_token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_used_at" TIMESTAMPTZ(3),
ADD COLUMN "revoked_reason" VARCHAR(120);

UPDATE "sessions"
SET "refresh_token_family_id" = "id"
WHERE "refresh_token_family_id" IS NULL;

ALTER TABLE "sessions"
ALTER COLUMN "refresh_token_family_id" SET NOT NULL;

CREATE INDEX "sessions_refresh_token_family_id_idx"
ON "sessions"("refresh_token_family_id");