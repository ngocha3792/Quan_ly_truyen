-- Expand the database so the account-security screens and the existing
-- frontend discovery/reader contracts can be implemented without mock-only data.

CREATE TYPE "mfa_method" AS ENUM ('totp');
CREATE TYPE "mfa_credential_status" AS ENUM ('pending', 'enabled', 'disabled');
CREATE TYPE "account_deletion_status" AS ENUM ('requested', 'canceled', 'completed');

ALTER TYPE "media_purpose" ADD VALUE IF NOT EXISTS 'genre_cover';
ALTER TYPE "story_status" ADD VALUE IF NOT EXISTS 'hiatus' AFTER 'published';

-- -----------------------------------------------------------------------------
-- User/account security metadata
-- -----------------------------------------------------------------------------
ALTER TABLE "users"
    ADD COLUMN "password_updated_at" TIMESTAMPTZ(3);

UPDATE "users"
SET "password_updated_at" = COALESCE("updated_at", "created_at")
WHERE "password_hash" IS NOT NULL
  AND "password_updated_at" IS NULL;

CREATE TABLE "mfa_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method" "mfa_method" NOT NULL DEFAULT 'totp',
    "status" "mfa_credential_status" NOT NULL DEFAULT 'pending',
    "encrypted_secret" TEXT NOT NULL,
    "enrollment_expires_at" TIMESTAMPTZ(3),
    "enrolled_device_name" VARCHAR(200),
    "last_used_step" BIGINT,
    "enabled_at" TIMESTAMPTZ(3),
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mfa_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mfa_credentials_state_consistent" CHECK (
        (
            "status" = 'pending'
            AND "enabled_at" IS NULL
            AND "disabled_at" IS NULL
            AND "enrollment_expires_at" IS NOT NULL
        )
        OR (
            "status" = 'enabled'
            AND "enabled_at" IS NOT NULL
            AND "disabled_at" IS NULL
        )
        OR (
            "status" = 'disabled'
            AND "disabled_at" IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX "mfa_credentials_user_id_method_key"
    ON "mfa_credentials"("user_id", "method");
CREATE INDEX "mfa_credentials_status_enrollment_expires_at_idx"
    ON "mfa_credentials"("status", "enrollment_expires_at");

CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "credential_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key"
    ON "mfa_recovery_codes"("code_hash");
CREATE INDEX "mfa_recovery_codes_credential_id_used_at_idx"
    ON "mfa_recovery_codes"("credential_id", "used_at");

CREATE TABLE "recovery_emails" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320),
    "verified_at" TIMESTAMPTZ(3),
    "pending_email" VARCHAR(320),
    "pending_code_hash" VARCHAR(255),
    "pending_requested_at" TIMESTAMPTZ(3),
    "pending_expires_at" TIMESTAMPTZ(3),
    "verification_sent_at" TIMESTAMPTZ(3),
    "failed_verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recovery_emails_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "recovery_emails_verified_state_consistent" CHECK (
        ("email" IS NULL AND "verified_at" IS NULL)
        OR ("email" IS NOT NULL AND "verified_at" IS NOT NULL)
    ),
    CONSTRAINT "recovery_emails_pending_state_consistent" CHECK (
        (
            "pending_email" IS NULL
            AND "pending_code_hash" IS NULL
            AND "pending_requested_at" IS NULL
            AND "pending_expires_at" IS NULL
        )
        OR (
            "pending_email" IS NOT NULL
            AND "pending_code_hash" IS NOT NULL
            AND "pending_requested_at" IS NOT NULL
            AND "pending_expires_at" IS NOT NULL
            AND "pending_expires_at" > "pending_requested_at"
        )
    ),
    CONSTRAINT "recovery_emails_attempts_non_negative" CHECK (
        "failed_verification_attempts" >= 0 AND "resend_count" >= 0
    ),
    CONSTRAINT "recovery_emails_current_and_pending_different" CHECK (
        "email" IS NULL
        OR "pending_email" IS NULL
        OR LOWER("email") <> LOWER("pending_email")
    )
);

CREATE INDEX "recovery_emails_pending_expires_at_idx"
    ON "recovery_emails"("pending_expires_at");
CREATE UNIQUE INDEX "recovery_emails_email_lower_unique"
    ON "recovery_emails"(LOWER("email"))
    WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "recovery_emails_pending_email_lower_unique"
    ON "recovery_emails"(LOWER("pending_email"))
    WHERE "pending_email" IS NOT NULL;

CREATE TABLE "security_questions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "security_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_questions_code_key"
    ON "security_questions"("code");
CREATE INDEX "security_questions_locale_is_active_sort_order_idx"
    ON "security_questions"("locale", "is_active", "sort_order");

INSERT INTO "security_questions" (
    "id", "code", "label", "locale", "is_active", "sort_order", "created_at", "updated_at"
) VALUES
    ('00000000-0000-4000-8000-000000000001', 'childhood_nickname', 'Biệt danh thời thơ ấu của bạn là gì?', 'vi', TRUE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000002', 'first_school', 'Tên trường tiểu học đầu tiên của bạn là gì?', 'vi', TRUE, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000003', 'first_teacher', 'Tên giáo viên đầu tiên của bạn là gì?', 'vi', TRUE, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000004', 'childhood_friend', 'Tên người bạn thân thời thơ ấu của bạn là gì?', 'vi', TRUE, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000005', 'favorite_childhood_book', 'Cuốn sách yêu thích thời thơ ấu của bạn là gì?', 'vi', TRUE, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000006', 'first_pet', 'Tên thú cưng đầu tiên của bạn là gì?', 'vi', TRUE, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000007', 'parents_meeting_city', 'Cha mẹ bạn gặp nhau lần đầu ở thành phố nào?', 'vi', TRUE, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000008', 'memorable_place', 'Địa điểm đáng nhớ nhất trong tuổi thơ của bạn là gì?', 'vi', TRUE, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "user_security_questions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_hash" VARCHAR(255) NOT NULL,
    "position" SMALLINT NOT NULL,
    "last_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_security_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_security_questions_position_valid" CHECK ("position" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "user_security_questions_user_id_question_id_key"
    ON "user_security_questions"("user_id", "question_id");
CREATE UNIQUE INDEX "user_security_questions_user_id_position_key"
    ON "user_security_questions"("user_id", "position");
CREATE INDEX "user_security_questions_question_id_idx"
    ON "user_security_questions"("question_id");

CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(120) NOT NULL,
    "device_name" VARCHAR(200),
    "fingerprint_hash" VARCHAR(255),
    "trust_token_hash" VARCHAR(255) NOT NULL,
    "trusted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trusted_devices_expiration_valid" CHECK ("expires_at" > "trusted_at")
);

CREATE UNIQUE INDEX "trusted_devices_trust_token_hash_key"
    ON "trusted_devices"("trust_token_hash");
CREATE UNIQUE INDEX "trusted_devices_user_id_device_id_key"
    ON "trusted_devices"("user_id", "device_id");
CREATE INDEX "trusted_devices_user_id_revoked_at_expires_at_idx"
    ON "trusted_devices"("user_id", "revoked_at", "expires_at");

CREATE TABLE "account_deletion_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "account_deletion_status" NOT NULL DEFAULT 'requested',
    "reason" TEXT,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "request_ip" VARCHAR(45),
    "request_user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_deletion_requests_schedule_valid" CHECK (
        "scheduled_for" >= "requested_at"
    ),
    CONSTRAINT "account_deletion_requests_state_consistent" CHECK (
        (
            "status" = 'requested'
            AND "canceled_at" IS NULL
            AND "completed_at" IS NULL
        )
        OR (
            "status" = 'canceled'
            AND "canceled_at" IS NOT NULL
            AND "completed_at" IS NULL
        )
        OR (
            "status" = 'completed'
            AND "completed_at" IS NOT NULL
        )
    )
);

CREATE INDEX "account_deletion_requests_status_scheduled_for_idx"
    ON "account_deletion_requests"("status", "scheduled_for");
CREATE INDEX "account_deletion_requests_user_id_requested_at_idx"
    ON "account_deletion_requests"("user_id", "requested_at");
CREATE UNIQUE INDEX "account_deletion_requests_one_active_per_user"
    ON "account_deletion_requests"("user_id")
    WHERE "status" = 'requested';

ALTER TABLE "sessions"
    ADD COLUMN "trusted_device_id" UUID;
CREATE INDEX "sessions_trusted_device_id_idx"
    ON "sessions"("trusted_device_id");

-- -----------------------------------------------------------------------------
-- Discovery, author directory and reader support
-- -----------------------------------------------------------------------------
ALTER TABLE "author_profiles"
    ADD COLUMN "slug" VARCHAR(160),
    ADD COLUMN "featured_rank" INTEGER,
    ADD COLUMN "follower_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "total_read_count" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "story_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "author_profiles"
SET "slug" = 'author-' || REPLACE("user_id"::TEXT, '-', '')
WHERE "slug" IS NULL;

UPDATE "author_profiles" AS author
SET
    "story_count" = stats.story_count,
    "follower_count" = stats.follower_count,
    "total_read_count" = stats.total_read_count
FROM (
    SELECT
        "author_id",
        COUNT(*) FILTER (WHERE "deleted_at" IS NULL)::INTEGER AS story_count,
        COALESCE(SUM("follower_count") FILTER (WHERE "deleted_at" IS NULL), 0)::INTEGER AS follower_count,
        COALESCE(SUM("view_count") FILTER (WHERE "deleted_at" IS NULL), 0)::BIGINT AS total_read_count
    FROM "stories"
    GROUP BY "author_id"
) AS stats
WHERE stats."author_id" = author."user_id";

ALTER TABLE "author_profiles"
    ALTER COLUMN "slug" SET NOT NULL,
    ADD CONSTRAINT "author_profiles_counters_non_negative" CHECK (
        "follower_count" >= 0 AND "total_read_count" >= 0 AND "story_count" >= 0
    ),
    ADD CONSTRAINT "author_profiles_featured_rank_positive" CHECK (
        "featured_rank" IS NULL OR "featured_rank" > 0
    );

CREATE UNIQUE INDEX "author_profiles_slug_key"
    ON "author_profiles"("slug");
CREATE UNIQUE INDEX "author_profiles_slug_lower_unique"
    ON "author_profiles"(LOWER("slug"));
CREATE INDEX "author_profiles_featured_rank_idx"
    ON "author_profiles"("featured_rank");
CREATE INDEX "author_profiles_follower_count_idx"
    ON "author_profiles"("follower_count");
CREATE INDEX "author_profiles_total_read_count_idx"
    ON "author_profiles"("total_read_count");

ALTER TABLE "stories"
    ADD COLUMN "release_year" SMALLINT,
    ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN "featured_order" INTEGER,
    ADD COLUMN "featured_until" TIMESTAMPTZ(3),
    ADD CONSTRAINT "stories_release_year_valid" CHECK (
        "release_year" IS NULL OR "release_year" BETWEEN 1000 AND 9999
    ),
    ADD CONSTRAINT "stories_featured_order_positive" CHECK (
        "featured_order" IS NULL OR "featured_order" > 0
    );

UPDATE "stories"
SET "release_year" = EXTRACT(YEAR FROM COALESCE("published_at", "created_at"))::SMALLINT
WHERE "release_year" IS NULL;

CREATE INDEX "stories_release_year_status_idx"
    ON "stories"("release_year", "status");
CREATE INDEX "stories_is_featured_featured_order_featured_until_idx"
    ON "stories"("is_featured", "featured_order", "featured_until");

ALTER TABLE "categories"
    ADD COLUMN "cover_media_id" UUID,
    ADD COLUMN "visual_key" VARCHAR(50),
    ADD COLUMN "tone" VARCHAR(30),
    ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN "featured_order" INTEGER,
    ADD CONSTRAINT "categories_featured_order_positive" CHECK (
        "featured_order" IS NULL OR "featured_order" > 0
    ),
    ADD CONSTRAINT "categories_visual_key_supported" CHECK (
        "visual_key" IS NULL OR "visual_key" IN (
            'action', 'fantasy', 'romance', 'comedy', 'manhwa', 'manhua',
            'horror', 'drama', 'adventure', 'school-life', 'sci-fi', 'isekai'
        )
    ),
    ADD CONSTRAINT "categories_tone_supported" CHECK (
        "tone" IS NULL OR "tone" IN (
            'red', 'violet', 'pink', 'yellow', 'purple',
            'orange', 'gray', 'blue', 'cyan', 'indigo'
        )
    );

CREATE INDEX "categories_is_featured_featured_order_idx"
    ON "categories"("is_featured", "featured_order");
CREATE INDEX "categories_cover_media_id_idx"
    ON "categories"("cover_media_id");

ALTER TABLE "chapters"
    ADD COLUMN "view_count" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "comment_count" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "chapters_counters_non_negative" CHECK (
        "view_count" >= 0 AND "comment_count" >= 0
    );

UPDATE "chapters" AS chapter
SET "view_count" = stats.view_count
FROM (
    SELECT "chapter_id", COALESCE(SUM("view_count"), 0)::BIGINT AS view_count
    FROM "chapter_daily_stats"
    GROUP BY "chapter_id"
) AS stats
WHERE stats."chapter_id" = chapter."id";

UPDATE "chapters" AS chapter
SET "comment_count" = stats.comment_count
FROM (
    SELECT "chapter_id", COUNT(*)::INTEGER AS comment_count
    FROM "comments"
    WHERE "chapter_id" IS NOT NULL
      AND "deleted_at" IS NULL
      AND "moderation_status" = 'visible'
    GROUP BY "chapter_id"
) AS stats
WHERE stats."chapter_id" = chapter."id";

CREATE TABLE "reading_bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "label" VARCHAR(200),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reading_bookmarks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_bookmarks_position_non_negative" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "reading_bookmarks_user_id_chapter_id_position_key"
    ON "reading_bookmarks"("user_id", "chapter_id", "position");
CREATE INDEX "reading_bookmarks_user_id_created_at_idx"
    ON "reading_bookmarks"("user_id", "created_at");
CREATE INDEX "reading_bookmarks_story_id_chapter_id_idx"
    ON "reading_bookmarks"("story_id", "chapter_id");

-- Composite key used to guarantee that a bookmark's chapter belongs to its story.
CREATE UNIQUE INDEX "chapters_id_story_id_unique"
    ON "chapters"("id", "story_id");

-- -----------------------------------------------------------------------------
-- Foreign keys
-- -----------------------------------------------------------------------------
ALTER TABLE "mfa_credentials"
    ADD CONSTRAINT "mfa_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_credential_id_fkey"
    FOREIGN KEY ("credential_id") REFERENCES "mfa_credentials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recovery_emails"
    ADD CONSTRAINT "recovery_emails_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_security_questions"
    ADD CONSTRAINT "user_security_questions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_security_questions"
    ADD CONSTRAINT "user_security_questions_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "security_questions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trusted_devices"
    ADD CONSTRAINT "trusted_devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_trusted_device_id_fkey"
    FOREIGN KEY ("trusted_device_id") REFERENCES "trusted_devices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_cover_media_id_fkey"
    FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reading_bookmarks"
    ADD CONSTRAINT "reading_bookmarks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_bookmarks"
    ADD CONSTRAINT "reading_bookmarks_story_id_fkey"
    FOREIGN KEY ("story_id") REFERENCES "stories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_bookmarks"
    ADD CONSTRAINT "reading_bookmarks_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_bookmarks"
    ADD CONSTRAINT "reading_bookmarks_chapter_story_fkey"
    FOREIGN KEY ("chapter_id", "story_id") REFERENCES "chapters"("id", "story_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
