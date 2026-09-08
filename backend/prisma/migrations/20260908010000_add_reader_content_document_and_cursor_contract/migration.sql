-- Sprint 0 reader foundation: canonical block documents and portable cursors.
-- The legacy content/position columns remain authoritative during rollout.

ALTER TABLE "chapters"
  ADD COLUMN IF NOT EXISTS "content_document" JSONB,
  ADD COLUMN IF NOT EXISTS "document_schema_version" INTEGER;

ALTER TABLE "chapter_versions"
  ADD COLUMN IF NOT EXISTS "content_document" JSONB,
  ADD COLUMN IF NOT EXISTS "document_schema_version" INTEGER;

ALTER TABLE "reading_progress"
  ADD COLUMN IF NOT EXISTS "cursor" JSONB,
  ADD COLUMN IF NOT EXISTS "cursor_schema_version" INTEGER;

CREATE OR REPLACE FUNCTION pg_temp.build_chapter_content_document(
  markdown TEXT,
  stable_seed TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  normalized TEXT := btrim(replace(replace(markdown, E'\r\n', E'\n'), E'\r', E'\n'));
  source_lines TEXT[];
  source_line TEXT;
  block_lines TEXT[] := ARRAY[]::TEXT[];
  in_fence BOOLEAN := FALSE;
  block_text TEXT;
  block_index INTEGER := 0;
  block_type TEXT;
  hash TEXT;
  block_id TEXT;
  blocks JSONB := '[]'::jsonb;
BEGIN
  IF normalized = '' THEN
    RETURN jsonb_build_object('schemaVersion', 1, 'blocks', blocks);
  END IF;

  source_lines := regexp_split_to_array(normalized, E'\n');
  FOREACH source_line IN ARRAY source_lines LOOP
    IF in_fence THEN
      block_lines := array_append(block_lines, source_line);
      IF source_line ~ '^```[\t ]*$' THEN
        in_fence := FALSE;
      END IF;
    ELSIF source_line ~ '^```' THEN
      block_lines := array_append(block_lines, source_line);
      in_fence := TRUE;
    ELSIF source_line ~ '^[\t ]*$' THEN
      IF cardinality(block_lines) = 0 THEN
        CONTINUE;
      END IF;
    ELSE
      block_lines := array_append(block_lines, source_line);
      CONTINUE;
    END IF;

    -- Flush only at a blank separator outside a fenced code block.
    IF source_line !~ '^[\t ]*$' OR in_fence THEN
      CONTINUE;
    END IF;

    block_text := btrim(array_to_string(block_lines, E'\n'));
    block_lines := ARRAY[]::TEXT[];
    block_index := block_index + 1;
    block_type := CASE
      WHEN block_text ~ '^```' THEN 'code'
      WHEN block_text ~ '^#{1,6}[\t ]+' THEN 'heading'
      WHEN block_text ~ '^>[\t ]?' THEN 'blockquote'
      WHEN block_text ~ '^([-+*]|[0-9]+[.)])[\t ]+' THEN 'list'
      WHEN block_text ~ '^(-{3,}|_{3,}|\*{3,})$' THEN 'horizontal_rule'
      ELSE 'paragraph'
    END;
    hash := md5(stable_seed || ':' || block_index::text);
    hash := overlay(hash placing '4' from 13 for 1);
    hash := overlay(hash placing '8' from 17 for 1);
    block_id := substring(hash from 1 for 8) || '-' ||
      substring(hash from 9 for 4) || '-' ||
      substring(hash from 13 for 4) || '-' ||
      substring(hash from 17 for 4) || '-' ||
      substring(hash from 21 for 12);
    blocks := blocks || jsonb_build_array(
      jsonb_build_object(
        'id', block_id,
        'type', block_type,
        'text', block_text,
        'marks', '[]'::jsonb
      )
    );
  END LOOP;

  IF cardinality(block_lines) > 0 THEN
    block_text := btrim(array_to_string(block_lines, E'\n'));
    block_index := block_index + 1;
    block_type := CASE
      WHEN block_text ~ '^```' THEN 'code'
      WHEN block_text ~ '^#{1,6}[\t ]+' THEN 'heading'
      WHEN block_text ~ '^>[\t ]?' THEN 'blockquote'
      WHEN block_text ~ '^([-+*]|[0-9]+[.)])[\t ]+' THEN 'list'
      WHEN block_text ~ '^(-{3,}|_{3,}|\*{3,})$' THEN 'horizontal_rule'
      ELSE 'paragraph'
    END;
    hash := md5(stable_seed || ':' || block_index::text);
    hash := overlay(hash placing '4' from 13 for 1);
    hash := overlay(hash placing '8' from 17 for 1);
    block_id := substring(hash from 1 for 8) || '-' ||
      substring(hash from 9 for 4) || '-' ||
      substring(hash from 13 for 4) || '-' ||
      substring(hash from 17 for 4) || '-' ||
      substring(hash from 21 for 12);
    blocks := blocks || jsonb_build_array(
      jsonb_build_object(
        'id', block_id,
        'type', block_type,
        'text', block_text,
        'marks', '[]'::jsonb
      )
    );
  END IF;

  RETURN jsonb_build_object('schemaVersion', 1, 'blocks', blocks);
END;
$$;

-- Idempotent backfill: only rows without a document are converted.
UPDATE "chapters"
SET
  "content_document" = pg_temp.build_chapter_content_document(
    "content",
    'chapter:' || "id"::text
  ),
  "document_schema_version" = 1
WHERE "content_document" IS NULL;

-- Preserve an already-written document if a previous run stopped between
-- writing the JSON projection and its separately indexed schema version.
UPDATE "chapters"
SET "document_schema_version" = ("content_document" ->> 'schemaVersion')::INTEGER
WHERE "content_document" IS NOT NULL
  AND "document_schema_version" IS NULL;

UPDATE "chapter_versions"
SET
  "content_document" = pg_temp.build_chapter_content_document(
    "content",
    'chapter:' || "chapter_id"::text
  ),
  "document_schema_version" = 1
WHERE "content_document" IS NULL;

UPDATE "chapter_versions"
SET "document_schema_version" = ("content_document" ->> 'schemaVersion')::INTEGER
WHERE "content_document" IS NOT NULL
  AND "document_schema_version" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chapters_content_document_v1_valid'
      AND conrelid = 'chapters'::regclass
  ) THEN
    ALTER TABLE "chapters" ADD CONSTRAINT "chapters_content_document_v1_valid"
      CHECK (
        ("content_document" IS NULL AND "document_schema_version" IS NULL)
        OR (
          "content_document" IS NOT NULL
          AND "document_schema_version" IS NOT NULL
          AND "document_schema_version" = 1
          AND jsonb_typeof("content_document") = 'object'
          AND "content_document" ->> 'schemaVersion' = '1'
          AND jsonb_typeof("content_document" -> 'blocks') = 'array'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chapter_versions_content_document_v1_valid'
      AND conrelid = 'chapter_versions'::regclass
  ) THEN
    ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_content_document_v1_valid"
      CHECK (
        ("content_document" IS NULL AND "document_schema_version" IS NULL)
        OR (
          "content_document" IS NOT NULL
          AND "document_schema_version" IS NOT NULL
          AND "document_schema_version" = 1
          AND jsonb_typeof("content_document") = 'object'
          AND "content_document" ->> 'schemaVersion' = '1'
          AND jsonb_typeof("content_document" -> 'blocks') = 'array'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reading_progress_cursor_contract_valid'
      AND conrelid = 'reading_progress'::regclass
  ) THEN
    ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_cursor_contract_valid"
      CHECK (
        ("cursor" IS NULL AND "cursor_schema_version" IS NULL)
        OR (
          "cursor" IS NOT NULL
          AND "cursor_schema_version" = 1
          AND jsonb_typeof("cursor") = 'object'
          AND "cursor" ->> 'schemaVersion' = '1'
          AND NOT ("cursor" ?| ARRAY['pixel', 'pixelX', 'pixelY', 'x', 'y'])
          AND CASE "cursor" ->> 'kind'
            WHEN 'text' THEN
              "cursor" ->> 'blockId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              AND CASE
                WHEN jsonb_typeof("cursor" -> 'characterOffset') = 'number'
                  THEN ("cursor" ->> 'characterOffset')::NUMERIC >= 0
                    AND mod(("cursor" ->> 'characterOffset')::NUMERIC, 1) = 0
                ELSE FALSE
              END
              AND CASE
                WHEN jsonb_typeof("cursor" -> 'viewportRatio') = 'number'
                  THEN ("cursor" ->> 'viewportRatio')::NUMERIC BETWEEN 0 AND 1
                ELSE FALSE
              END
            WHEN 'comic' THEN
              (
                "cursor" ->> 'mediaAssetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                OR "cursor" ->> 'sliceId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              )
              AND CASE
                WHEN jsonb_typeof("cursor" -> 'relativeY') = 'number'
                  THEN ("cursor" ->> 'relativeY')::NUMERIC BETWEEN 0 AND 1
                ELSE FALSE
              END
            ELSE FALSE
          END
        )
      );
  END IF;
END;
$$;
