-- Phase 5: persistent author follows + idempotent follower notifications.
--
-- There was no historical user<->author follow source before this migration.
-- AuthorProfile.follower_count is therefore reconciled to the new relation
-- source of truth instead of inventing identities from legacy numeric counts.

CREATE TABLE "user_follow_authors" (
    "user_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follow_authors_pkey" PRIMARY KEY ("user_id", "author_id")
);

CREATE INDEX "user_follow_authors_user_created_at_idx"
    ON "user_follow_authors"("user_id", "created_at");

CREATE INDEX "user_follow_authors_author_user_idx"
    ON "user_follow_authors"("author_id", "user_id");

ALTER TABLE "user_follow_authors"
    ADD CONSTRAINT "user_follow_authors_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_follow_authors"
    ADD CONSTRAINT "user_follow_authors_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "author_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD COLUMN "dedupe_key" VARCHAR(255);

CREATE UNIQUE INDEX "notifications_dedupe_key_unique"
    ON "notifications"("dedupe_key");

-- Source-of-truth reconciliation. The new relation is empty on first deploy,
-- so any synthetic/seed-only legacy follower counts become 0 deterministically.
UPDATE "author_profiles" AS author
SET "follower_count" = COALESCE(follows."count", 0)
FROM (
    SELECT profile."user_id", COUNT(follow."user_id")::INTEGER AS "count"
    FROM "author_profiles" AS profile
    LEFT JOIN "user_follow_authors" AS follow
      ON follow."author_id" = profile."user_id"
    GROUP BY profile."user_id"
) AS follows
WHERE author."user_id" = follows."user_id";
