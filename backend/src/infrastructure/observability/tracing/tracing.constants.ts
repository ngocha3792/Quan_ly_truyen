export const OBSERVABILITY_TRACER_NAME = 'quan-ly-truyen';

export const MANUAL_SPANS = {
  USER_REGISTER: 'user.register',
  OUTBOX_DISPATCH_BATCH: 'outbox.dispatch_batch',
  OUTBOX_PUBLISH_EVENT: 'outbox.publish_event',
  MAIL_DISPATCH: 'mail.dispatch',
  CLOUDINARY_WEBHOOK_PROCESS: 'cloudinary.webhook.process',
  MEDIA_CLEANUP: 'media.cleanup',
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',
  IDEMPOTENCY_ACQUIRE: 'idempotency.acquire',
  LOCK_ACQUIRE: 'lock.acquire',
} as const;
