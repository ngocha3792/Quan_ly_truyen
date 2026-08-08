-- CreateEnum
CREATE TYPE "author_application_status" AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- DropForeignKey
ALTER TABLE "reading_bookmarks" DROP CONSTRAINT "reading_bookmarks_chapter_story_fkey";

-- CreateTable
CREATE TABLE "author_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "author_application_status" NOT NULL DEFAULT 'draft',
    "pen_name" VARCHAR(40),
    "full_name" VARCHAR(80),
    "email" VARCHAR(320),
    "phone" VARCHAR(30),
    "portfolio_url" VARCHAR(500),
    "primary_genre" VARCHAR(80),
    "experience" VARCHAR(50),
    "introduction" TEXT,
    "first_work_synopsis" TEXT,
    "accepted_terms" BOOLEAN NOT NULL DEFAULT false,
    "sample_media_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "author_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "author_applications_user_id_key" ON "author_applications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "author_applications_sample_media_id_key" ON "author_applications"("sample_media_id");

-- CreateIndex
CREATE INDEX "author_applications_status_submitted_at_idx" ON "author_applications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "author_applications_reviewed_by_id_idx" ON "author_applications"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "author_applications_updated_at_idx" ON "author_applications"("updated_at");

-- AddForeignKey
ALTER TABLE "author_applications" ADD CONSTRAINT "author_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_applications" ADD CONSTRAINT "author_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_applications" ADD CONSTRAINT "author_applications_sample_media_id_fkey" FOREIGN KEY ("sample_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
