-- Abort with an actionable error instead of silently reconciling ambiguous taxonomy data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tags GROUP BY LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')) HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate tag names exist case-insensitively; reconcile tags before applying taxonomy name uniqueness.';
  END IF;

  IF EXISTS (SELECT 1 FROM categories GROUP BY LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')) HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate category names exist case-insensitively; review categories manually before applying taxonomy name uniqueness.';
  END IF;
END $$;

CREATE UNIQUE INDEX tags_name_lower_unique ON tags (LOWER(name));
CREATE UNIQUE INDEX categories_name_lower_unique ON categories (LOWER(name));
