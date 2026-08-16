CREATE TYPE "author_lifecycle_status" AS ENUM ('active', 'suspended', 'revoked');

ALTER TABLE "author_profiles"
  ADD COLUMN "lifecycle_status" "author_lifecycle_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "status_reason" TEXT,
  ADD COLUMN "status_updated_at" TIMESTAMPTZ(3),
  ADD COLUMN "status_updated_by" UUID;

UPDATE "author_profiles"
SET "lifecycle_status" = 'active'
WHERE "lifecycle_status" IS NULL;

CREATE INDEX "author_profiles_lifecycle_status_created_at_idx"
  ON "author_profiles"("lifecycle_status", "created_at");

-- New Phase 1 author-admin capabilities must exist on already-populated databases.
INSERT INTO "permissions" ("id", "code", "name", "resource", "action", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'author.read', 'Read author lifecycle administration', 'author', 'read', NOW(), NOW()),
  (gen_random_uuid(), 'author.status.manage', 'Manage author lifecycle status', 'author', 'status.manage', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action",
  "updated_at" = NOW();

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role_row."id", permission_row."id", NOW()
FROM "roles" AS role_row
JOIN "permissions" AS permission_row
  ON permission_row."code" IN ('author.read', 'author.status.manage')
WHERE role_row."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
