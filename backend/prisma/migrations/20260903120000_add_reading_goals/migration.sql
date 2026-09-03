-- Per-user weekly reading goal (target chapters/week), read alongside
-- ReadingSession to compute progress. One row per user; absence of a row
-- means the user has not configured a goal yet.

CREATE TABLE "reading_goals" (
    "user_id" UUID NOT NULL,
    "target_chapters" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reading_goals_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "reading_goals"
    ADD CONSTRAINT "reading_goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
