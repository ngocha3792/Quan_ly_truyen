CREATE TYPE "unlock_policy" AS ENUM ('permanent_paid', 'early_access');
ALTER TABLE "chapter_monetization"
  ADD COLUMN "unlock_policy" "unlock_policy" NOT NULL DEFAULT 'permanent_paid',
  ADD COLUMN "free_at" TIMESTAMPTZ(3),
  ADD COLUMN "paid_window_days" INTEGER,
  ADD COLUMN "original_price_credits" BIGINT,
  ADD CONSTRAINT "chapter_monetization_early_access_check" CHECK (
    ("unlock_policy" = 'permanent_paid' AND "free_at" IS NULL AND "paid_window_days" IS NULL)
    OR
    ("unlock_policy" = 'early_access' AND ("free_at" IS NOT NULL OR ("paid_window_days" IS NOT NULL AND "paid_window_days" > 0)))
  );
ALTER TABLE "chapter_pricing_versions"
  ADD COLUMN "unlock_policy" "unlock_policy" NOT NULL DEFAULT 'permanent_paid',
  ADD COLUMN "free_at" TIMESTAMPTZ(3),
  ADD COLUMN "paid_window_days" INTEGER;
