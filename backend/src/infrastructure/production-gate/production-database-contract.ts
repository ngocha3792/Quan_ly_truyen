export const EXPECTED_PRODUCTION_INDEXES = [
  'users_email_lower_unique',

  'users_username_lower_unique',

  'author_profiles_pen_name_lower_unique',

  'stories_slug_lower_unique',

  'categories_slug_lower_unique',

  'tags_slug_lower_unique',

  'categories_name_lower_unique',

  'tags_name_lower_unique',

  'audit_logs_created_at_idx',

  'audit_logs_actor_id_created_at_idx',

  'audit_logs_action_created_at_idx',

  'audit_logs_entity_type_entity_id_created_at_idx',

  'audit_logs_request_id_created_at_idx',

  'user_follow_authors_pkey',

  'user_follow_authors_user_created_at_idx',

  'user_follow_authors_author_user_idx',

  'notifications_dedupe_key_unique',

  'reader_analytics_events_event_id_unique',

  'reader_analytics_events_processing_idx',

  'reader_analytics_events_story_occurred_idx',

  'reader_analytics_events_chapter_occurred_idx',

  'reader_analytics_events_viewer_occurred_idx',

  'reader_analytics_events_type_occurred_idx',

  'reader_analytics_events_queue_recovery_idx',

  'reader_analytics_started_session_unique',

  'reader_analytics_completed_session_unique',

  'story_categories_one_primary_per_story',

  'story_submissions_one_pending_per_story',

  'reports_open_story_unique',

  'reports_open_chapter_unique',

  'reports_open_comment_unique',

  'reports_open_user_unique',

  'recovery_emails_email_lower_unique',

  'recovery_emails_pending_email_lower_unique',

  'account_deletion_requests_one_active_per_user',

  'author_profiles_slug_lower_unique',

  'chapters_id_story_id_unique',

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

  'mfa_credentials_state_consistent',

  'recovery_emails_verified_state_consistent',

  'recovery_emails_pending_state_consistent',

  'recovery_emails_attempts_non_negative',

  'recovery_emails_current_and_pending_different',

  'user_security_questions_position_valid',

  'trusted_devices_expiration_valid',

  'account_deletion_requests_schedule_valid',

  'account_deletion_requests_state_consistent',

  'author_profiles_counters_non_negative',

  'author_profiles_featured_rank_positive',

  'stories_release_year_valid',

  'stories_featured_order_positive',

  'categories_featured_order_positive',

  'categories_visual_key_supported',

  'categories_tone_supported',

  'chapters_counters_non_negative',

  'reading_bookmarks_position_non_negative',

  'reader_analytics_events_progress_valid',

  'reader_analytics_events_active_seconds_valid',

  'reader_analytics_events_version_valid',

  'reader_analytics_events_context_valid',
] as const;

export const EXPECTED_PRODUCTION_ROLE_CODES = [
  'USER',

  'AUTHOR',

  'ADMIN',
] as const;
