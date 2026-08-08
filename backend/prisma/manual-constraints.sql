-- Run this SQL inside the first Prisma migration AFTER Prisma creates the tables.
-- Keep it version-controlled with migrations. Do not execute it repeatedly without
-- guarding against existing constraint/index names.

-- Case-insensitive business identifiers.
CREATE UNIQUE INDEX users_email_lower_unique
  ON users (LOWER(email));

CREATE UNIQUE INDEX users_username_lower_unique
  ON users (LOWER(username));

CREATE UNIQUE INDEX author_profiles_pen_name_lower_unique
  ON author_profiles (LOWER(pen_name));

-- Only one pending author application may reserve a pen name.
CREATE UNIQUE INDEX author_applications_pending_pen_name_lower_unique
  ON author_applications (LOWER(pen_name))
  WHERE status = 'pending' AND pen_name IS NOT NULL;

CREATE UNIQUE INDEX stories_slug_lower_unique
  ON stories (LOWER(slug));

CREATE UNIQUE INDEX categories_slug_lower_unique
  ON categories (LOWER(slug));

CREATE UNIQUE INDEX tags_slug_lower_unique
  ON tags (LOWER(slug));

-- Numeric domain constraints.
ALTER TABLE ratings
  ADD CONSTRAINT ratings_score_between_1_and_5
  CHECK (score BETWEEN 1 AND 5);

ALTER TABLE stories
  ADD CONSTRAINT stories_rating_average_between_0_and_5
  CHECK (rating_average BETWEEN 0 AND 5);

ALTER TABLE chapters
  ADD CONSTRAINT chapters_number_positive
  CHECK (number > 0);

ALTER TABLE library_entries
  ADD CONSTRAINT library_entries_progress_between_0_and_100
  CHECK (progress_percent BETWEEN 0 AND 100);

ALTER TABLE reading_progress
  ADD CONSTRAINT reading_progress_percent_between_0_and_100
  CHECK (progress_percent BETWEEN 0 AND 100);

ALTER TABLE reading_sessions
  ADD CONSTRAINT reading_sessions_positions_non_negative
  CHECK (
    start_position >= 0
    AND (end_position IS NULL OR end_position >= 0)
    AND (duration_seconds IS NULL OR duration_seconds >= 0)
  );

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_size_non_negative
  CHECK (size_bytes >= 0);

-- Exactly one report target must be populated, and it must match target_type.
ALTER TABLE reports
  ADD CONSTRAINT reports_exactly_one_matching_target
  CHECK (
    num_nonnulls(story_id, chapter_id, comment_id, reported_user_id) = 1
    AND (
      (target_type = 'story' AND story_id IS NOT NULL)
      OR (target_type = 'chapter' AND chapter_id IS NOT NULL)
      OR (target_type = 'comment' AND comment_id IS NOT NULL)
      OR (target_type = 'user' AND reported_user_id IS NOT NULL)
    )
  );

-- A moderation action points to one concrete moderated target.
ALTER TABLE moderation_actions
  ADD CONSTRAINT moderation_actions_exactly_one_target
  CHECK (num_nonnulls(story_id, chapter_id, comment_id, target_user_id) = 1);

-- Only one primary category and one pending review submission per story.
CREATE UNIQUE INDEX story_categories_one_primary_per_story
  ON story_categories (story_id)
  WHERE is_primary = TRUE;

CREATE UNIQUE INDEX story_submissions_one_pending_per_story
  ON story_submissions (story_id)
  WHERE status = 'pending';

-- Prevent a user from reporting the same target repeatedly while a report is open.
CREATE UNIQUE INDEX reports_open_story_unique
  ON reports (reporter_id, story_id)
  WHERE story_id IS NOT NULL AND status IN ('open', 'in_review');

CREATE UNIQUE INDEX reports_open_chapter_unique
  ON reports (reporter_id, chapter_id)
  WHERE chapter_id IS NOT NULL AND status IN ('open', 'in_review');

CREATE UNIQUE INDEX reports_open_comment_unique
  ON reports (reporter_id, comment_id)
  WHERE comment_id IS NOT NULL AND status IN ('open', 'in_review');

CREATE UNIQUE INDEX reports_open_user_unique
  ON reports (reporter_id, reported_user_id)
  WHERE reported_user_id IS NOT NULL AND status IN ('open', 'in_review');

-- The application must still verify cross-table ownership, for example:
-- comments.chapter_id belongs to comments.story_id;
-- reading_progress.current_chapter_id belongs to reading_progress.story_id;
-- library_entries.last_read_chapter_id belongs to library_entries.story_id;
-- reading_sessions.chapter_id belongs to reading_sessions.story_id.

-- Account-security and frontend-support constraints introduced after the initial
-- schema. These are also included in the corresponding versioned migration.
ALTER TABLE mfa_credentials
  ADD CONSTRAINT mfa_credentials_state_consistent
  CHECK (
    (status = 'pending' AND enabled_at IS NULL AND disabled_at IS NULL AND enrollment_expires_at IS NOT NULL)
    OR (status = 'enabled' AND enabled_at IS NOT NULL AND disabled_at IS NULL)
    OR (status = 'disabled' AND disabled_at IS NOT NULL)
  );

ALTER TABLE recovery_emails
  ADD CONSTRAINT recovery_emails_verified_state_consistent
  CHECK (
    (email IS NULL AND verified_at IS NULL)
    OR (email IS NOT NULL AND verified_at IS NOT NULL)
  );

CREATE UNIQUE INDEX recovery_emails_email_lower_unique
  ON recovery_emails (LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX recovery_emails_pending_email_lower_unique
  ON recovery_emails (LOWER(pending_email))
  WHERE pending_email IS NOT NULL;

CREATE UNIQUE INDEX account_deletion_requests_one_active_per_user
  ON account_deletion_requests (user_id)
  WHERE status = 'requested';

CREATE UNIQUE INDEX author_profiles_slug_lower_unique
  ON author_profiles (LOWER(slug));

ALTER TABLE stories
  ADD CONSTRAINT stories_release_year_valid
  CHECK (release_year IS NULL OR release_year BETWEEN 1000 AND 9999);

ALTER TABLE reading_bookmarks
  ADD CONSTRAINT reading_bookmarks_position_non_negative
  CHECK (position >= 0);
