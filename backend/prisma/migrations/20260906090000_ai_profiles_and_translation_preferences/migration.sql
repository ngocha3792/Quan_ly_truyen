CREATE TABLE "ai_user_profiles" (
    "user_id" UUID NOT NULL,
    "model" VARCHAR(200),
    "system_prompt" TEXT,
    "default_translation_language_code" VARCHAR(10) NOT NULL DEFAULT 'en',
    "auto_translate_on_publish" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_user_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "ai_story_profiles" (
    "story_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "model" VARCHAR(200),
    "system_prompt" TEXT,
    "default_translation_language_code" VARCHAR(10),
    "auto_translate_on_publish" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_story_profiles_pkey" PRIMARY KEY ("story_id")
);

CREATE INDEX "ai_story_profiles_user_id_idx" ON "ai_story_profiles"("user_id");

ALTER TABLE "ai_user_profiles"
ADD CONSTRAINT "ai_user_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_story_profiles"
ADD CONSTRAINT "ai_story_profiles_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_story_profiles"
ADD CONSTRAINT "ai_story_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
