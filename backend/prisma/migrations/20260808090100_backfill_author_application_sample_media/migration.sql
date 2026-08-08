UPDATE "media_assets" AS media
SET "purpose" = 'author_application_sample'::"media_purpose"
FROM "author_applications" AS application
WHERE media."purpose" = 'attachment'::"media_purpose"
  AND media."uploader_id" = application."user_id"
  AND media."metadata" ->> 'ownerId' = application."id"::text;
