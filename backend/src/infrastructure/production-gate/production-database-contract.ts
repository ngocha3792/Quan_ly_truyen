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

  'wallets_user_currency_unique',

  'wallets_user_id_updated_at_idx',

  'wallet_ledger_transactions_idempotency_key_unique',

  'wallet_ledger_transactions_business_reference_unique',

  'wallet_ledger_transactions_wallet_history_idx',

  'wallet_ledger_entries_transaction_wallet_unique',

  'wallet_ledger_entries_transaction_system_unique',

  'wallet_ledger_entries_wallet_history_idx',

  'monetization_price_bands_code_key',

  'monetization_price_bands_active_sort_idx',

  'chapter_monetization_access_updated_idx',

  'chapter_monetization_price_band_idx',

  'chapter_pricing_versions_chapter_version_key',

  'chapter_pricing_versions_actor_created_idx',

  'chapter_purchases_wallet_transaction_key',

  'chapter_purchases_idempotency_key_key',

  'chapter_purchases_user_history_idx',

  'chapter_purchases_chapter_created_idx',

  'chapter_purchases_refund_wallet_transaction_key',

  'chapter_purchases_status_created_idx',

  'chapter_purchases_refunder_refunded_idx',

  'chapter_entitlements_purchase_key',

  'chapter_entitlements_user_chapter_key',

  'chapter_entitlements_chapter_status_idx',

  'credit_packages_code_key',

  'credit_packages_active_sort_idx',

  'payment_orders_idempotency_key_key',

  'payment_orders_wallet_transaction_id_key',

  'payment_orders_provider_reference_unique',

  'payment_orders_user_created_idx',

  'payment_orders_status_expiry_idx',

  'payment_orders_provider_status_updated_idx',
  'payment_orders_provider_connection_id_idx',
  'payment_orders_status_review_requested_idx',
  'payment_provider_connections_code_key',
  'payment_provider_connections_enabled_sort_idx',
  'payment_provider_connections_kind_idx',

  'reading_progress_sync_events_user_id_client_event_id_key',

  'reading_progress_sync_events_server_sequence_key',

  'reading_progress_sync_events_user_id_story_id_server_sequence_idx',

  'reading_progress_user_id_device_id_idx',
] as const;

export const EXPECTED_PRODUCTION_CONSTRAINTS = [
  'ratings_score_between_1_and_5',

  'stories_rating_average_between_0_and_5',

  'chapters_number_positive',

  'library_entries_progress_between_0_and_100',

  'reading_progress_percent_between_0_and_100',

  'chapters_content_document_v1_valid',

  'chapter_versions_content_document_v1_valid',

  'reading_progress_cursor_contract_valid',

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

  'wallets_balance_non_negative',

  'wallets_balance_within_limit',

  'wallets_version_non_negative',

  'wallet_ledger_transactions_wallet_amount_non_zero',

  'wallet_ledger_transactions_wallet_amount_within_limit',

  'wallet_ledger_transactions_balance_non_negative',

  'wallet_ledger_transactions_balance_within_limit',

  'wallet_ledger_transactions_request_hash_format',

  'wallet_ledger_entries_amount_non_zero',

  'wallet_ledger_entries_amount_within_limit',

  'wallet_ledger_entries_exactly_one_account',

  'wallet_ledger_transaction_balanced',

  'monetization_price_bands_credit_price_check',

  'monetization_price_bands_code_check',

  'monetization_price_bands_label_check',

  'chapter_monetization_version_check',

  'chapter_monetization_access_shape_check',

  'chapter_pricing_versions_version_check',

  'chapter_pricing_versions_access_shape_check',

  'chapter_purchases_credit_price_check',

  'chapter_purchases_idempotency_key_check',

  'chapter_purchases_request_hash_check',

  'chapter_purchases_refund_shape_check',

  'chapter_entitlements_status_shape_check',

  'credit_packages_amounts_positive_check',

  'credit_packages_code_check',

  'credit_packages_label_check',

  'credit_packages_currency_check',

  'payment_orders_amounts_positive_check',

  'payment_orders_currency_check',

  'payment_orders_provider_check',

  'payment_orders_idempotency_key_check',

  'payment_orders_request_hash_check',

  'payment_orders_expiry_check',

  'payment_orders_status_shape_check',
  'payment_provider_connections_code_check',
  'payment_provider_connections_name_check',
  'payment_provider_connections_currency_check',
  'payment_provider_connections_ttl_check',

  'reading_progress_realtime_cursor_valid',

  'reading_progress_sync_events_revision_valid',
] as const;

export const EXPECTED_PRODUCTION_ROLE_CODES = [
  'USER',

  'AUTHOR',

  'ADMIN',
] as const;
