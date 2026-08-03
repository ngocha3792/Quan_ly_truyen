export const EXPECTED_PRODUCTION_INDEXES = [
  'users_email_lower_unique',

  'users_username_lower_unique',

  'author_profiles_pen_name_lower_unique',

  'stories_slug_lower_unique',

  'categories_slug_lower_unique',

  'tags_slug_lower_unique',

  'story_categories_one_primary_per_story',

  'story_submissions_one_pending_per_story',

  'reports_open_story_unique',

  'reports_open_chapter_unique',

  'reports_open_comment_unique',

  'reports_open_user_unique',

  /*
   * Đã thêm trong phase retention.
   */
  'outbox_events_retention_idx',
] as const;

export const EXPECTED_PRODUCTION_CONSTRAINTS = [
  'ratings_score_between_1_and_5',

  'stories_rating_average_between_0_and_5',

  'chapters_number_positive',

  'library_entries_progress_between_0_and_100',

  'reading_progress_percent_between_0_and_100',

  'reading_sessions_positions_non_negative',

  'media_assets_size_non_negative',

  'reports_exactly_one_matching_target',

  'moderation_actions_exactly_one_target',
] as const;

export const EXPECTED_PRODUCTION_ROLE_CODES = [
  'USER',

  'AUTHOR',

  'ADMIN',
] as const;
