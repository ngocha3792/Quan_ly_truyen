CREATE TYPE "tts_provider" AS ENUM ('eleven_labs');
CREATE TYPE "tts_fallback_policy" AS ENUM ('none', 'system');
CREATE TYPE "tts_manifest_status" AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE "tts_segment_status" AS ENUM ('pending', 'generated', 'failed');

CREATE TABLE "tts_voice_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "provider" "tts_provider" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "voice_id" VARCHAR(255) NOT NULL,
  "voice_name" VARCHAR(120) NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "encrypted_api_key" TEXT NOT NULL,
  "stability" DECIMAL(4,3),
  "similarity" DECIMAL(4,3),
  "style" DECIMAL(4,3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tts_voice_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tts_voice_connections_owner_check" CHECK (
    ("is_system" AND "user_id" IS NULL) OR (NOT "is_system" AND "user_id" IS NOT NULL)
  ),
  CONSTRAINT "tts_voice_connections_text_check" CHECK (
    length(btrim("name")) > 0 AND length(btrim("voice_id")) > 0 AND length(btrim("voice_name")) > 0
  ),
  CONSTRAINT "tts_voice_connections_language_check" CHECK ("language" ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  CONSTRAINT "tts_voice_connections_style_check" CHECK (
    ("stability" IS NULL OR "stability" BETWEEN 0 AND 1) AND
    ("similarity" IS NULL OR "similarity" BETWEEN 0 AND 1) AND
    ("style" IS NULL OR "style" BETWEEN 0 AND 1)
  ),
  CONSTRAINT "tts_voice_connections_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "tts_voice_connections_user_active_idx" ON "tts_voice_connections"("user_id", "is_active");
CREATE INDEX "tts_voice_connections_system_idx" ON "tts_voice_connections"("provider", "is_system", "is_active");
CREATE UNIQUE INDEX "tts_voice_connections_one_system_voice_key"
  ON "tts_voice_connections"("provider", "voice_id", "language") WHERE "is_system" AND "is_active";

CREATE TABLE "tts_manifests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "chapter_id" UUID NOT NULL,
  "connection_id" UUID NOT NULL,
  "chapter_version" INTEGER NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "voice_id" VARCHAR(255) NOT NULL,
  "style_hash" VARCHAR(64) NOT NULL,
  "fallback_policy" "tts_fallback_policy" NOT NULL DEFAULT 'none',
  "status" "tts_manifest_status" NOT NULL DEFAULT 'pending',
  "total_segments" INTEGER NOT NULL,
  "completed_segments" INTEGER NOT NULL DEFAULT 0,
  "character_count" INTEGER NOT NULL,
  "total_duration_ms" INTEGER,
  "estimated_cost_micros" BIGINT,
  "job_id" VARCHAR(255),
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "failure_reason" VARCHAR(1000),
  "last_accessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tts_manifests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tts_manifests_counts_check" CHECK (
    "chapter_version" > 0 AND "total_segments" > 0 AND "completed_segments" BETWEEN 0 AND "total_segments" AND
    "character_count" > 0 AND ("total_duration_ms" IS NULL OR "total_duration_ms" >= 0) AND
    ("estimated_cost_micros" IS NULL OR "estimated_cost_micros" >= 0)
  ),
  CONSTRAINT "tts_manifests_language_check" CHECK ("language" ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  CONSTRAINT "tts_manifests_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "tts_manifests_chapter_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE,
  CONSTRAINT "tts_manifests_connection_fkey" FOREIGN KEY ("connection_id") REFERENCES "tts_voice_connections"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "tts_manifests_user_cache_key"
  ON "tts_manifests"("user_id", "chapter_id", "chapter_version", "language", "voice_id", "style_hash");
CREATE INDEX "tts_manifests_user_status_created_idx" ON "tts_manifests"("user_id", "status", "created_at");
CREATE INDEX "tts_manifests_chapter_status_idx" ON "tts_manifests"("chapter_id", "status");

CREATE TABLE "tts_segments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "manifest_id" UUID NOT NULL,
  "block_id" UUID NOT NULL,
  "block_index" INTEGER NOT NULL,
  "block_text" TEXT NOT NULL,
  "status" "tts_segment_status" NOT NULL DEFAULT 'pending',
  "audio_public_id" VARCHAR(512),
  "duration_ms" INTEGER,
  "size_bytes" BIGINT,
  "format" VARCHAR(20),
  "start_time_ms" INTEGER,
  "end_time_ms" INTEGER,
  "word_timings" JSONB,
  "character_count" INTEGER NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "generated_at" TIMESTAMPTZ(3),
  "failure_reason" VARCHAR(1000),
  "used_system_fallback" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tts_segments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tts_segments_manifest_fkey" FOREIGN KEY ("manifest_id") REFERENCES "tts_manifests"("id") ON DELETE CASCADE,
  CONSTRAINT "tts_segments_values_check" CHECK (
    "block_index" >= 0 AND length("block_text") > 0 AND "character_count" > 0 AND "retry_count" >= 0 AND
    ("duration_ms" IS NULL OR "duration_ms" >= 0) AND ("size_bytes" IS NULL OR "size_bytes" >= 0) AND
    ("start_time_ms" IS NULL OR "start_time_ms" >= 0) AND ("end_time_ms" IS NULL OR "end_time_ms" >= "start_time_ms")
  )
);

CREATE UNIQUE INDEX "tts_segments_manifest_block_key" ON "tts_segments"("manifest_id", "block_id");
CREATE UNIQUE INDEX "tts_segments_manifest_index_key" ON "tts_segments"("manifest_id", "block_index");
CREATE INDEX "tts_segments_status_updated_idx" ON "tts_segments"("status", "updated_at");

CREATE TABLE "tts_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "connection_id" UUID,
  "manifest_id" UUID NOT NULL,
  "provider" "tts_provider" NOT NULL,
  "character_count" INTEGER NOT NULL,
  "segment_count" INTEGER NOT NULL,
  "total_duration_ms" INTEGER NOT NULL,
  "estimated_cost_micros" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tts_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tts_usage_values_check" CHECK (
    "character_count" >= 0 AND "segment_count" >= 0 AND "total_duration_ms" >= 0 AND
    ("estimated_cost_micros" IS NULL OR "estimated_cost_micros" >= 0)
  ),
  CONSTRAINT "tts_usage_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "tts_usage_connection_fkey" FOREIGN KEY ("connection_id") REFERENCES "tts_voice_connections"("id") ON DELETE SET NULL,
  CONSTRAINT "tts_usage_manifest_fkey" FOREIGN KEY ("manifest_id") REFERENCES "tts_manifests"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "tts_usage_manifest_id_key" ON "tts_usage"("manifest_id");
CREATE INDEX "tts_usage_user_created_idx" ON "tts_usage"("user_id", "created_at");
CREATE INDEX "tts_usage_provider_created_idx" ON "tts_usage"("provider", "created_at");

CREATE TABLE "tts_quotas" (
  "user_id" UUID NOT NULL,
  "monthly_character_limit" INTEGER NOT NULL DEFAULT 50000,
  "current_month_usage" INTEGER NOT NULL DEFAULT 0,
  "reserved_characters" INTEGER NOT NULL DEFAULT 0,
  "current_month_start" DATE NOT NULL,
  "total_characters" BIGINT NOT NULL DEFAULT 0,
  "total_segments" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tts_quotas_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "tts_quotas_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "tts_quotas_values_check" CHECK (
    "monthly_character_limit" > 0 AND "current_month_usage" >= 0 AND "reserved_characters" >= 0 AND
    "current_month_usage" + "reserved_characters" <= "monthly_character_limit" AND
    "total_characters" >= 0 AND "total_segments" >= 0
  )
);

INSERT INTO "tts_quotas" ("user_id", "current_month_start")
SELECT "id", date_trunc('month', CURRENT_TIMESTAMP)::date FROM "users"
ON CONFLICT ("user_id") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "resource", "action", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'tts.generate.self', 'Generate text to speech audio for accessible chapters', 'tts', 'generate.self', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'tts.connection.manage.self', 'Manage own text to speech provider connections', 'tts.connection', 'manage.self', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'tts.settings.manage', 'Manage system text to speech settings', 'tts.settings', 'manage', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."code" IN ('USER', 'AUTHOR', 'ADMIN')
  AND permission."code" IN ('tts.generate.self', 'tts.connection.manage.self')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."code" = 'ADMIN' AND permission."code" = 'tts.settings.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
