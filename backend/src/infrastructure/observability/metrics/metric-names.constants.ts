export const METRIC_NAMES = {
  HTTP_REQUESTS: 'qlt_http_server_requests_total',
  HTTP_DURATION: 'qlt_http_server_request_duration_seconds',
  HTTP_ACTIVE: 'qlt_http_server_active_requests',
  AUTH_ACCESS_SESSION_DB_LOOKUP_DURATION:
    'qlt_auth_access_session_db_lookup_duration_seconds',
  OUTBOX_EVENTS: 'qlt_outbox_events_total',
  OUTBOX_DURATION: 'qlt_outbox_dispatch_duration_seconds',
  OUTBOX_STALE_RECOVERED: 'qlt_outbox_stale_recovered_total',
  OUTBOX_BACKLOG: 'qlt_outbox_backlog_events',
  OUTBOX_OLDEST_PENDING: 'qlt_outbox_oldest_pending_age_seconds',
  QUEUE_JOBS: 'qlt_queue_jobs',
  QUEUE_WORKERS: 'qlt_queue_workers',
  QUEUE_OLDEST_WAITING: 'qlt_queue_oldest_waiting_age_seconds',
  MAIL_DELIVERIES: 'qlt_mail_deliveries_total',
  MAIL_DURATION: 'qlt_mail_delivery_duration_seconds',
  MAIL_SMTP_VERIFY: 'qlt_mail_smtp_verify_total',
  MEDIA_UPLOADS: 'qlt_media_uploads_total',
  MEDIA_CLEANUP: 'qlt_media_cleanup_total',
  CLOUDINARY_WEBHOOK_EVENTS: 'qlt_cloudinary_webhook_events_total',
  CLOUDINARY_WEBHOOK_BACKLOG: 'qlt_cloudinary_webhook_backlog_events',
  CLOUDINARY_WEBHOOK_OLDEST_PENDING:
    'qlt_cloudinary_webhook_oldest_pending_age_seconds',
  CACHE_OPERATIONS: 'qlt_cache_operations_total',
  LOCK_OPERATIONS: 'qlt_distributed_lock_operations_total',
  LOCK_WAIT: 'qlt_distributed_lock_wait_duration_seconds',
  IDEMPOTENCY_OPERATIONS: 'qlt_idempotency_operations_total',
  REDIS_ERRORS: 'qlt_redis_errors_total',
  DEPENDENCY_HEALTH: 'qlt_dependency_health',
  COMMENT_OPERATIONS: 'qlt_comment_operations_total',
  COMMENT_REACTIONS: 'qlt_comment_reactions_total',
  COMMENT_REPORTS: 'qlt_comment_reports_total',
  COMMENT_MODERATION_ACTIONS: 'qlt_comment_moderation_actions_total',
  COMMENT_ABUSE_BLOCKS: 'qlt_comment_abuse_blocks_total',
  AUDIT_LOG_READ_REQUESTS: 'qlt_audit_log_read_requests_total',
  READER_ANALYTICS_EVENTS_RECEIVED:
    'qlt_reader_analytics_events_received_total',
  READER_ANALYTICS_EVENTS_PROCESSED:
    'qlt_reader_analytics_events_processed_total',
  READER_ANALYTICS_EVENTS_REJECTED:
    'qlt_reader_analytics_events_rejected_total',
  READER_ANALYTICS_RECONCILIATION_MISMATCHES:
    'qlt_reader_analytics_reconciliation_mismatches_total',
  READER_ANALYTICS_ENABLED: 'qlt_reader_analytics_enabled',
  READER_ANALYTICS_BACKLOG: 'qlt_reader_analytics_backlog_events',
  READER_ANALYTICS_OLDEST_UNPROCESSED:
    'qlt_reader_analytics_oldest_unprocessed_age_seconds',
  READER_ANALYTICS_RECONCILIATION_HEALTH:
    'qlt_reader_analytics_reconciliation_healthy',
  READER_ANALYTICS_RECONCILIATION_AGE:
    'qlt_reader_analytics_reconciliation_age_seconds',
  READER_ANALYTICS_SNAPSHOT_HEALTH:
    'qlt_reader_analytics_metrics_snapshot_healthy',
  MONETIZATION_ENABLED: 'qlt_monetization_enabled',
  MONETIZATION_ROLLOUT_STAGE: 'qlt_monetization_rollout_stage',
  MONETIZATION_FINANCIAL_INTEGRITY_MISMATCHES:
    'qlt_monetization_financial_integrity_mismatches',
  MONETIZATION_INTEGRITY_SNAPSHOT_HEALTHY:
    'qlt_monetization_integrity_snapshot_healthy',
  PAYMENT_WEBHOOK_BACKLOG: 'qlt_payment_webhook_backlog_events',
  PAYMENT_WEBHOOK_OLDEST_PENDING:
    'qlt_payment_webhook_oldest_pending_age_seconds',
} as const;
