DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offline_package_status') THEN
    CREATE TYPE "offline_package_status" AS ENUM (
      'preparing',
      'ready',
      'expired',
      'revoked'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offline_chapter_access_state') THEN
    CREATE TYPE "offline_chapter_access_state" AS ENUM ('free', 'entitled');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "offline_packages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "session_id" UUID,
  "device_id" VARCHAR(120),
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "status" "offline_package_status" NOT NULL DEFAULT 'preparing',
  "total_size_bytes" BIGINT NOT NULL DEFAULT 0,
  "chapter_count" INTEGER NOT NULL DEFAULT 0,
  "license_expires_at" TIMESTAMPTZ(3) NOT NULL,
  "last_accessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "auto_delete_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "revoked_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offline_packages_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "offline_packages_session_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL,
  CONSTRAINT "offline_packages_size_count_valid" CHECK (
    "total_size_bytes" >= 0 AND "chapter_count" >= 0
  ),
  CONSTRAINT "offline_packages_lifecycle_valid" CHECK (
    "license_expires_at" > "created_at"
    AND "auto_delete_at" >= "last_accessed_at"
    AND (("status" = 'revoked') = ("revoked_at" IS NOT NULL))
  )
);

CREATE TABLE IF NOT EXISTS "offline_package_chapters" (
  "package_id" UUID NOT NULL,
  "chapter_id" UUID NOT NULL,
  "story_id" UUID NOT NULL,
  "story_slug" VARCHAR(255) NOT NULL,
  "story_title" VARCHAR(255) NOT NULL,
  "chapter_number" DECIMAL(10,2) NOT NULL,
  "chapter_title" VARCHAR(255) NOT NULL,
  "chapter_slug" VARCHAR(255) NOT NULL,
  "chapter_version" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "content_format" "content_format" NOT NULL,
  "content_document" JSONB NOT NULL,
  "document_schema_version" INTEGER NOT NULL,
  "word_count" INTEGER NOT NULL,
  "published_at" TIMESTAMPTZ(3) NOT NULL,
  "access_type" "chapter_access_type" NOT NULL,
  "access_state" "offline_chapter_access_state" NOT NULL,
  "price_credits" BIGINT,
  "entitlement_id" UUID,
  "content_size_bytes" BIGINT NOT NULL,
  "media_count" INTEGER NOT NULL DEFAULT 0,
  "media_snapshot" JSONB NOT NULL,
  "snapshot_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_package_chapters_pkey" PRIMARY KEY ("package_id", "chapter_id"),
  CONSTRAINT "offline_package_chapters_package_fkey"
    FOREIGN KEY ("package_id") REFERENCES "offline_packages"("id") ON DELETE CASCADE,
  CONSTRAINT "offline_package_chapters_snapshot_valid" CHECK (
    "chapter_version" > 0
    AND "document_schema_version" > 0
    AND "word_count" >= 0
    AND "content_size_bytes" >= 0
    AND "media_count" >= 0
  ),
  CONSTRAINT "offline_package_chapters_access_snapshot_valid" CHECK (
    ("access_type" = 'free' AND "access_state" = 'free' AND "entitlement_id" IS NULL AND "price_credits" IS NULL)
    OR
    ("access_type" = 'paid' AND "access_state" = 'entitled' AND "entitlement_id" IS NOT NULL AND "price_credits" IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS "offline_package_media_pins" (
  "package_id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_package_media_pins_pkey"
    PRIMARY KEY ("package_id", "media_asset_id"),
  CONSTRAINT "offline_package_media_pins_package_fkey"
    FOREIGN KEY ("package_id") REFERENCES "offline_packages"("id") ON DELETE CASCADE,
  CONSTRAINT "offline_package_media_pins_media_asset_fkey"
    FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "offline_quotas" (
  "user_id" UUID NOT NULL,
  "max_packages" INTEGER NOT NULL DEFAULT 5,
  "max_total_size_bytes" BIGINT NOT NULL DEFAULT 524288000,
  "max_chapters_per_package" INTEGER NOT NULL DEFAULT 50,
  "current_packages" INTEGER NOT NULL DEFAULT 0,
  "current_size_bytes" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_quotas_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "offline_quotas_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "offline_quotas_limits_valid" CHECK (
    "max_packages" > 0
    AND "max_total_size_bytes" > 0
    AND "max_chapters_per_package" > 0
    AND "current_packages" >= 0
    AND "current_size_bytes" >= 0
  )
);

CREATE INDEX IF NOT EXISTS "offline_packages_user_status_accessed_idx"
  ON "offline_packages"("user_id", "status", "last_accessed_at");
CREATE INDEX IF NOT EXISTS "offline_packages_user_device_status_idx"
  ON "offline_packages"("user_id", "device_id", "status");
CREATE INDEX IF NOT EXISTS "offline_packages_session_status_idx"
  ON "offline_packages"("session_id", "status");
CREATE INDEX IF NOT EXISTS "offline_packages_status_auto_delete_idx"
  ON "offline_packages"("status", "auto_delete_at");
CREATE INDEX IF NOT EXISTS "offline_packages_license_status_idx"
  ON "offline_packages"("license_expires_at", "status");
CREATE INDEX IF NOT EXISTS "offline_package_chapters_chapter_idx"
  ON "offline_package_chapters"("chapter_id");
CREATE INDEX IF NOT EXISTS "offline_package_chapters_entitlement_idx"
  ON "offline_package_chapters"("entitlement_id");
CREATE INDEX IF NOT EXISTS "offline_package_media_pins_media_asset_idx"
  ON "offline_package_media_pins"("media_asset_id");

INSERT INTO "offline_quotas" ("user_id")
SELECT "id" FROM "users"
ON CONFLICT ("user_id") DO NOTHING;

CREATE OR REPLACE FUNCTION reconcile_offline_quota_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE "offline_quotas" AS quota
  SET
    "current_packages" = usage."package_count",
    "current_size_bytes" = usage."total_size_bytes",
    "updated_at" = CURRENT_TIMESTAMP
  FROM (
    SELECT
      COUNT(*)::INTEGER AS "package_count",
      COALESCE(SUM("total_size_bytes"), 0)::BIGINT AS "total_size_bytes"
    FROM "offline_packages"
    WHERE "user_id" = p_user_id
      AND "status" = 'ready'
  ) AS usage
  WHERE quota."user_id" = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reconcile_offline_quota_from_package()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM reconcile_offline_quota_usage(OLD."user_id");
    RETURN OLD;
  END IF;

  PERFORM reconcile_offline_quota_usage(NEW."user_id");
  IF TG_OP = 'UPDATE' AND NEW."user_id" <> OLD."user_id" THEN
    PERFORM reconcile_offline_quota_usage(OLD."user_id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "offline_packages_reconcile_quota" ON "offline_packages";
CREATE TRIGGER "offline_packages_reconcile_quota"
AFTER INSERT OR DELETE OR UPDATE OF "status", "total_size_bytes", "user_id"
ON "offline_packages"
FOR EACH ROW
EXECUTE FUNCTION reconcile_offline_quota_from_package();

CREATE OR REPLACE FUNCTION release_offline_media_pins_when_not_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'ready' AND NEW."status" <> 'ready' THEN
    DELETE FROM "offline_package_media_pins"
    WHERE "package_id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "offline_packages_release_media_pins" ON "offline_packages";
CREATE TRIGGER "offline_packages_release_media_pins"
AFTER UPDATE OF "status" ON "offline_packages"
FOR EACH ROW
EXECUTE FUNCTION release_offline_media_pins_when_not_ready();

CREATE OR REPLACE FUNCTION revoke_offline_packages_for_session()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_revoked_at TIMESTAMPTZ(3);
  v_reason VARCHAR(500);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_session_id := OLD."id";
    v_revoked_at := CURRENT_TIMESTAMP;
    v_reason := 'session_deleted';
  ELSIF OLD."revoked_at" IS NULL AND NEW."revoked_at" IS NOT NULL THEN
    v_session_id := NEW."id";
    v_revoked_at := NEW."revoked_at";
    v_reason := COALESCE(NEW."revoked_reason", 'session_revoked');
  ELSE
    RETURN NEW;
  END IF;

  UPDATE "offline_packages"
  SET
    "status" = 'revoked',
    "revoked_at" = v_revoked_at,
    "revoked_reason" = v_reason,
    "auto_delete_at" = LEAST("auto_delete_at", v_revoked_at + INTERVAL '7 days'),
    "updated_at" = v_revoked_at
  WHERE "session_id" = v_session_id
    AND "status" IN ('preparing', 'ready');

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "sessions_revoke_offline_packages" ON "sessions";
CREATE TRIGGER "sessions_revoke_offline_packages"
AFTER UPDATE OF "revoked_at" ON "sessions"
FOR EACH ROW
EXECUTE FUNCTION revoke_offline_packages_for_session();

DROP TRIGGER IF EXISTS "sessions_delete_offline_packages" ON "sessions";
CREATE TRIGGER "sessions_delete_offline_packages"
BEFORE DELETE ON "sessions"
FOR EACH ROW
EXECUTE FUNCTION revoke_offline_packages_for_session();

CREATE OR REPLACE FUNCTION revoke_offline_packages_for_entitlement()
RETURNS TRIGGER AS $$
DECLARE
  v_entitlement_id UUID;
  v_revoked_at TIMESTAMPTZ(3);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entitlement_id := OLD."id";
    v_revoked_at := CURRENT_TIMESTAMP;
  ELSIF OLD."status" = 'active' AND NEW."status" = 'revoked' THEN
    v_entitlement_id := NEW."id";
    v_revoked_at := COALESCE(NEW."revoked_at", CURRENT_TIMESTAMP);
  ELSE
    RETURN NEW;
  END IF;

  UPDATE "offline_packages" AS package
  SET
    "status" = 'revoked',
    "revoked_at" = v_revoked_at,
    "revoked_reason" = 'chapter_entitlement_revoked',
    "auto_delete_at" = LEAST(
      package."auto_delete_at",
      v_revoked_at + INTERVAL '7 days'
    ),
    "updated_at" = v_revoked_at
  FROM "offline_package_chapters" AS snapshot
  WHERE snapshot."package_id" = package."id"
    AND snapshot."entitlement_id" = v_entitlement_id
    AND package."status" IN ('preparing', 'ready');

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "entitlements_revoke_offline_packages" ON "chapter_entitlements";
CREATE TRIGGER "entitlements_revoke_offline_packages"
AFTER UPDATE OF "status" ON "chapter_entitlements"
FOR EACH ROW
EXECUTE FUNCTION revoke_offline_packages_for_entitlement();

DROP TRIGGER IF EXISTS "entitlements_delete_offline_packages" ON "chapter_entitlements";
CREATE TRIGGER "entitlements_delete_offline_packages"
BEFORE DELETE ON "chapter_entitlements"
FOR EACH ROW
EXECUTE FUNCTION revoke_offline_packages_for_entitlement();
