CREATE TYPE "translation_review_status" AS ENUM ('pending', 'approved', 'rejected', 'revision_requested');
CREATE TYPE "ai_job_type" AS ENUM ('chapter_translation', 'chapter_summary', 'story_summary', 'character_extraction', 'consistency_check');
CREATE TYPE "ai_job_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

ALTER TABLE "chapter_translations"
  ADD COLUMN "source_version" INTEGER,
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1 CHECK ("generation" > 0),
  ADD COLUMN "lease_token" UUID,
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "review_status" "translation_review_status" NOT NULL DEFAULT 'pending',
  ADD COLUMN "revision_notes" VARCHAR(2000),
  ADD COLUMN "reviewed_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);

CREATE TABLE "ai_author_jobs" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "story_id" UUID NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "chapter_id" UUID REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "connection_id" UUID NOT NULL,
  "job_type" "ai_job_type" NOT NULL,
  "status" "ai_job_status" NOT NULL DEFAULT 'pending',
  "source_snapshot" JSONB NOT NULL,
  "result" JSONB,
  "input_tokens" INTEGER CHECK ("input_tokens" >= 0),
  "output_tokens" INTEGER CHECK ("output_tokens" >= 0),
  "total_cost" DECIMAL(12,6) CHECK ("total_cost" >= 0),
  "protocol" VARCHAR(60), "model" VARCHAR(255), "failure_reason" VARCHAR(500),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "lease_token" UUID, "lease_expires_at" TIMESTAMPTZ(3),
  "started_at" TIMESTAMPTZ(3), "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "ai_author_jobs_user_id_status_created_at_idx" ON "ai_author_jobs"("user_id", "status", "created_at");
CREATE INDEX "ai_author_jobs_story_id_job_type_idx" ON "ai_author_jobs"("story_id", "job_type");
CREATE INDEX "ai_author_jobs_chapter_id_job_type_idx" ON "ai_author_jobs"("chapter_id", "job_type");
CREATE INDEX "ai_author_jobs_status_created_at_idx" ON "ai_author_jobs"("status", "created_at");

CREATE TABLE "story_characters" (
  "id" UUID PRIMARY KEY,
  "story_id" UUID NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" VARCHAR(255) NOT NULL, "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "description" TEXT, "first_appearance" UUID, "appearances" JSONB, "relationships" JSONB,
  "extracted_by" UUID, "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "story_characters_story_id_name_key" ON "story_characters"("story_id", "name");
CREATE INDEX "story_characters_story_id_idx" ON "story_characters"("story_id");

CREATE TABLE "chapter_consistency_issues" (
  "id" UUID PRIMARY KEY,
  "chapter_id" UUID NOT NULL REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "source_version" INTEGER NOT NULL CHECK ("source_version" > 0),
  "issue_type" VARCHAR(50) NOT NULL, "severity" VARCHAR(20) NOT NULL,
  "description" TEXT NOT NULL, "suggestion" TEXT, "block_id" UUID,
  "related_chapter_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "detected_by" UUID NOT NULL,
  "is_dismissed" BOOLEAN NOT NULL DEFAULT false, "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "chapter_consistency_issues_chapter_id_is_dismissed_is_resolved_idx" ON "chapter_consistency_issues"("chapter_id", "is_dismissed", "is_resolved");
