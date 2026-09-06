CREATE TYPE "ai_rate_limit_tier" AS ENUM ('free', 'pro', 'enterprise');

CREATE TYPE "ai_fallback_policy" AS ENUM ('none', 'system');

CREATE TABLE "ai_user_policies" (
    "user_id" UUID NOT NULL,
    "rate_limit_tier" "ai_rate_limit_tier" NOT NULL DEFAULT 'free',
    "fallback_policy" "ai_fallback_policy" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_user_policies_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "ai_rate_limit_buckets" (
    "user_id" UUID NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_rate_limit_buckets_pkey" PRIMARY KEY ("user_id", "window_start")
);

CREATE INDEX "ai_user_policies_rate_limit_tier_idx" ON "ai_user_policies"("rate_limit_tier");
CREATE INDEX "ai_rate_limit_buckets_window_start_idx" ON "ai_rate_limit_buckets"("window_start");

ALTER TABLE "ai_user_policies"
ADD CONSTRAINT "ai_user_policies_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_rate_limit_buckets"
ADD CONSTRAINT "ai_rate_limit_buckets_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
