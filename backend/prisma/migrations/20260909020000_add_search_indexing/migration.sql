CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION search_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT lower(public.unaccent('public.unaccent', value));
$$;
CREATE INDEX stories_search_title_trgm_idx ON stories USING gin (search_normalize(title) gin_trgm_ops);
CREATE INDEX chapters_search_title_trgm_idx ON chapters USING gin (search_normalize(title) gin_trgm_ops);

CREATE TABLE search_index_checkpoints (
  index_name varchar(100) PRIMARY KEY,
  active_index varchar(150), shadow_index varchar(150), retired_index varchar(150),
  phase varchar(20) NOT NULL DEFAULT 'REQUESTED', cursor varchar(60),
  total_documents integer NOT NULL DEFAULT 0,
  last_processed_event_id uuid, last_processed_at timestamptz(3),
  last_full_rebuild_at timestamptz(3), last_error varchar(500),
  failed_documents integer NOT NULL DEFAULT 0,
  updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT search_checkpoint_phase CHECK (phase IN ('REQUESTED', 'SCANNING', 'CATCHUP', 'IDLE'))
);
CREATE TABLE search_dirty_documents (
  id varchar(60) PRIMARY KEY, revision bigint NOT NULL DEFAULT 1,
  changed_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX search_dirty_documents_changed_at_id_idx ON search_dirty_documents(changed_at, id);

-- This view is also the authoritative PostgreSQL fallback. Never select paid
-- bodies, even for authenticated viewers: only the deliberate public preview.
CREATE VIEW search_public_stories AS
SELECT s.*, a.pen_name,
  COALESCE(cat.names, ARRAY[]::text[]) AS category_names,
  COALESCE(cat.slugs, ARRAY[]::text[]) AS category_slugs,
  COALESCE(tag.names, ARRAY[]::text[]) AS tag_names,
  COALESCE(tag.slugs, ARRAY[]::text[]) AS tag_slugs
FROM stories s
JOIN author_profiles a ON a.user_id = s.author_id
LEFT JOIN LATERAL (
  SELECT array_agg(c.name::text ORDER BY c.slug) AS names, array_agg(c.slug::text ORDER BY c.slug) AS slugs
  FROM story_categories sc JOIN categories c ON c.id = sc.category_id
  WHERE sc.story_id = s.id AND c.is_active
) cat ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.name::text ORDER BY t.slug) AS names, array_agg(t.slug::text ORDER BY t.slug) AS slugs
  FROM story_tags st JOIN tags t ON t.id = st.tag_id WHERE st.story_id = s.id
) tag ON true
WHERE s.status IN ('published', 'hiatus', 'completed') AND s.visibility = 'public'
  AND s.deleted_at IS NULL AND s.published_at IS NOT NULL;

CREATE VIEW search_public_documents AS
SELECT 'story_' || s.id::text AS id, s.id AS entity_id, 'story'::text AS kind,
  s.title, s.slug, s.synopsis AS content, s.pen_name AS author_name,
  s.category_names AS categories, s.category_slugs, s.tag_names AS tags, s.tag_slugs,
  s.id AS story_id, s.slug AS story_slug, s.title AS story_title,
  NULL::numeric AS number, 'free'::text AS access_type,
  s.status::text AS status, s.content_rating::text, s.release_year, s.is_featured,
  s.published_at, s.view_count, s.follower_count, s.rating_average
FROM search_public_stories s
UNION ALL
SELECT 'chapter_' || c.id::text, c.id, 'chapter', c.title, c.slug,
  CASE WHEN COALESCE(m.access_type::text, 'free') = 'free' THEN c.content
       ELSE COALESCE(m.preview_content, '') END,
  s.pen_name, s.category_names, s.category_slugs, s.tag_names, s.tag_slugs,
  s.id, s.slug, s.title, c.number, COALESCE(m.access_type::text, 'free'),
  s.status::text, s.content_rating::text, s.release_year, s.is_featured,
  c.published_at, s.view_count, s.follower_count, s.rating_average
FROM chapters c JOIN search_public_stories s ON s.id = c.story_id
LEFT JOIN chapter_monetization m ON m.chapter_id = c.id
WHERE c.status = 'published' AND c.deleted_at IS NULL AND c.published_at IS NOT NULL;

-- Capture mutations inside the business transaction, including admin edits,
-- scheduling workers, SQL maintenance, unpublish/delete and pricing changes.
CREATE FUNCTION search_mark_document(document_id text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE event_id uuid := gen_random_uuid(); current_revision bigint;
BEGIN
  INSERT INTO search_dirty_documents(id) VALUES(document_id)
  ON CONFLICT(id) DO UPDATE SET revision = search_dirty_documents.revision + 1
  RETURNING revision INTO current_revision;
  -- Coalesce repeated changes until indexed. The periodic sweep also recovers
  -- dirty rows when queue retention or an exhausted retry removed the job.
  IF current_revision > 1 THEN RETURN; END IF;
  INSERT INTO outbox_events(id, aggregate_type, aggregate_id, event_type, payload)
  VALUES(event_id, 'search', document_id, 'search.document.changed.v1',
    jsonb_build_object('version', 1, 'documentId', document_id));
END;
$$;

CREATE FUNCTION search_mark_story(story_uuid uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE chapter_id_var uuid;
BEGIN
  PERFORM search_mark_document('story_' || story_uuid::text);
  FOR chapter_id_var IN SELECT c.id FROM chapters AS c WHERE c.story_id = story_uuid ORDER BY c.id LOOP
    PERFORM search_mark_document('chapter_' || chapter_id_var::text);
  END LOOP;
END;
$$;

CREATE FUNCTION search_capture_story() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM search_mark_story(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
END;
$$;
CREATE TRIGGER search_story_created AFTER INSERT OR DELETE ON stories
FOR EACH ROW EXECUTE FUNCTION search_capture_story();

CREATE TRIGGER search_story_ranking_changed AFTER UPDATE OF view_count, follower_count, rating_average ON stories
FOR EACH ROW WHEN (OLD.view_count IS DISTINCT FROM NEW.view_count OR OLD.follower_count IS DISTINCT FROM NEW.follower_count OR OLD.rating_average IS DISTINCT FROM NEW.rating_average)
EXECUTE FUNCTION search_capture_story();
CREATE TRIGGER search_story_changed AFTER UPDATE OF title, slug, synopsis, author_id,
  status, visibility, content_rating, release_year, is_featured, published_at, deleted_at ON stories
FOR EACH ROW EXECUTE FUNCTION search_capture_story();

CREATE FUNCTION search_capture_chapter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM search_mark_document('chapter_' || OLD.id::text);
    PERFORM search_mark_document('story_' || OLD.story_id::text);
  ELSE
    PERFORM search_mark_document('chapter_' || NEW.id::text);
    PERFORM search_mark_document('story_' || NEW.story_id::text);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER search_chapter_created AFTER INSERT OR DELETE ON chapters
FOR EACH ROW EXECUTE FUNCTION search_capture_chapter();
CREATE TRIGGER search_chapter_changed AFTER UPDATE OF title, slug, number, story_id,
  content, content_document, status, published_at, deleted_at ON chapters
FOR EACH ROW EXECUTE FUNCTION search_capture_chapter();

CREATE FUNCTION search_capture_pricing() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM search_mark_document('chapter_' || (CASE WHEN TG_OP = 'DELETE' THEN OLD.chapter_id ELSE NEW.chapter_id END)::text);
  RETURN NULL;
END;
$$;
CREATE TRIGGER search_pricing_changed AFTER INSERT OR UPDATE OR DELETE ON chapter_monetization
FOR EACH ROW EXECUTE FUNCTION search_capture_pricing();

CREATE FUNCTION search_capture_taxonomy_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM search_mark_story(CASE WHEN TG_OP = 'DELETE' THEN OLD.story_id ELSE NEW.story_id END);
  IF TG_OP = 'UPDATE' AND OLD.story_id <> NEW.story_id THEN PERFORM search_mark_story(OLD.story_id); END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER search_category_link AFTER INSERT OR UPDATE OR DELETE ON story_categories
FOR EACH ROW EXECUTE FUNCTION search_capture_taxonomy_link();
CREATE TRIGGER search_tag_link AFTER INSERT OR UPDATE OR DELETE ON story_tags
FOR EACH ROW EXECUTE FUNCTION search_capture_taxonomy_link();

CREATE FUNCTION search_capture_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE story_id_var uuid;
BEGIN
  IF TG_TABLE_NAME = 'author_profiles' THEN
    FOR story_id_var IN SELECT s.id FROM stories AS s WHERE s.author_id = NEW.user_id ORDER BY s.id LOOP
      PERFORM search_mark_story(story_id_var);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'categories' THEN
    FOR story_id_var IN SELECT sc.story_id FROM story_categories AS sc WHERE sc.category_id = NEW.id ORDER BY sc.story_id LOOP
      PERFORM search_mark_story(story_id_var);
    END LOOP;
  ELSE
    FOR story_id_var IN SELECT st.story_id FROM story_tags AS st WHERE st.tag_id = NEW.id ORDER BY st.story_id LOOP
      PERFORM search_mark_story(story_id_var);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER search_author_name AFTER UPDATE OF pen_name ON author_profiles
FOR EACH ROW EXECUTE FUNCTION search_capture_metadata();
CREATE TRIGGER search_category_name AFTER UPDATE OF name, slug, is_active ON categories
FOR EACH ROW EXECUTE FUNCTION search_capture_metadata();
CREATE TRIGGER search_tag_name AFTER UPDATE OF name, slug ON tags
FOR EACH ROW EXECUTE FUNCTION search_capture_metadata();

INSERT INTO permissions(id, code, name, resource, action, created_at, updated_at)
VALUES(gen_random_uuid(), 'search.manage', 'Manage search indexing', 'search', 'manage', now(), now())
ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id, granted_at)
SELECT r.id, p.id, now() FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code = 'search.manage'
ON CONFLICT(role_id, permission_id) DO NOTHING;
