ALTER TYPE "chapter_status" ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE "chapter_status" ADD VALUE IF NOT EXISTS 'approved';
CREATE TYPE "chapter_version_type" AS ENUM ('autosave', 'manual_save', 'published');
CREATE TYPE "chapter_review_decision" AS ENUM ('approved', 'rejected', 'request_changes');
ALTER TABLE "chapter_versions"
  ADD COLUMN "version_type" "chapter_version_type" NOT NULL DEFAULT 'manual_save',
  ADD COLUMN "is_retained" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "expires_at" TIMESTAMPTZ(3);
CREATE INDEX "chapter_versions_chapter_id_created_at_idx" ON "chapter_versions"("chapter_id", "created_at");
CREATE INDEX "chapter_versions_version_type_expires_at_idx" ON "chapter_versions"("version_type", "expires_at");
CREATE TABLE "chapter_reviews" (
  "id" UUID PRIMARY KEY,
  "chapter_id" UUID NOT NULL REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reviewer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decision" "chapter_review_decision" NOT NULL,
  "comment" TEXT,
  "reviewed_version" INTEGER NOT NULL CHECK ("reviewed_version" > 0),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "chapter_reviews_chapter_id_created_at_idx" ON "chapter_reviews"("chapter_id", "created_at");
CREATE INDEX "chapter_reviews_reviewer_id_created_at_idx" ON "chapter_reviews"("reviewer_id", "created_at");
CREATE TABLE "chapter_edit_sessions" (
  "id" UUID PRIMARY KEY,
  "chapter_id" UUID NOT NULL REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "session_token" VARCHAR(64) NOT NULL UNIQUE,
  "active_tab_id" VARCHAR(64) NOT NULL,
  "last_heartbeat_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chapter_edit_sessions_chapter_id_user_id_active_tab_id_key" UNIQUE ("chapter_id", "user_id", "active_tab_id")
);
CREATE INDEX "chapter_edit_sessions_chapter_id_last_heartbeat_at_idx" ON "chapter_edit_sessions"("chapter_id", "last_heartbeat_at");
CREATE INDEX "chapter_edit_sessions_expires_at_idx" ON "chapter_edit_sessions"("expires_at");
