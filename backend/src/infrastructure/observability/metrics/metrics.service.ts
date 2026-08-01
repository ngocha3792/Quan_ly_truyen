import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

import type { ObservabilityConfig } from '@/config';
import {
  QUEUE_NAMES,
  type QueueName,
} from '@/infrastructure/queue/queue.constants';

import { METRIC_NAMES } from './metric-names.constants';

type HttpStatusCode = `${number}` | 'unknown';
type OperationResult =
  | 'success'
  | 'failed'
  | 'retry'
  | 'skipped'
  | 'ownership_lost'
  | 'conflict'
  | 'replay'
  | 'miss'
  | 'hit'
  | 'disabled';
type OutboxStatusLabel = 'pending' | 'processing' | 'failed';
type QueueState = 'waiting' | 'active' | 'delayed' | 'failed';
type MailTemplate =
  | 'email-verification.v1'
  | 'password-reset.v1'
  | 'change-email.v1'
  | 'moderation-result.v1'
  | 'new-chapter.v1'
  | 'unknown';
type CloudinaryEventType =
  | 'upload'
  | 'resource_created'
  | 'resource_uploaded'
  | 'delete'
  | 'resource_deleted'
  | 'ping'
  | 'unknown';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry();
  private readonly enabled: boolean;

  private readonly httpRequests = new Counter({
    name: METRIC_NAMES.HTTP_REQUESTS,
    help: 'Total HTTP server requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: METRIC_NAMES.HTTP_DURATION,
    help: 'HTTP server request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly activeHttp = new Gauge({
    name: METRIC_NAMES.HTTP_ACTIVE,
    help: 'Current active HTTP server requests',
    labelNames: ['method'] as const,
    registers: [this.registry],
  });
  private readonly outboxEvents = new Counter({
    name: METRIC_NAMES.OUTBOX_EVENTS,
    help: 'Outbox event dispatch outcomes',
    labelNames: ['event_type', 'result'] as const,
    registers: [this.registry],
  });
  private readonly outboxDuration = new Histogram({
    name: METRIC_NAMES.OUTBOX_DURATION,
    help: 'Outbox event dispatch duration in seconds',
    labelNames: ['result'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly outboxStaleRecovered = new Counter({
    name: METRIC_NAMES.OUTBOX_STALE_RECOVERED,
    help: 'Stale outbox claims recovered',
    registers: [this.registry],
  });
  private readonly outboxBacklog = new Gauge({
    name: METRIC_NAMES.OUTBOX_BACKLOG,
    help: 'Outbox backlog by bounded status',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });
  private readonly outboxOldestPending = new Gauge({
    name: METRIC_NAMES.OUTBOX_OLDEST_PENDING,
    help: 'Age of the oldest pending outbox event in seconds',
    registers: [this.registry],
  });
  private readonly queueJobs = new Gauge({
    name: METRIC_NAMES.QUEUE_JOBS,
    help: 'BullMQ jobs by queue and state',
    labelNames: ['queue', 'state'] as const,
    registers: [this.registry],
  });
  private readonly queueWorkers = new Gauge({
    name: METRIC_NAMES.QUEUE_WORKERS,
    help: 'BullMQ workers by queue',
    labelNames: ['queue'] as const,
    registers: [this.registry],
  });
  private readonly queueOldestWaiting = new Gauge({
    name: METRIC_NAMES.QUEUE_OLDEST_WAITING,
    help: 'Age of the oldest waiting BullMQ job in seconds',
    labelNames: ['queue'] as const,
    registers: [this.registry],
  });
  private readonly mailDeliveries = new Counter({
    name: METRIC_NAMES.MAIL_DELIVERIES,
    help: 'Mail delivery outcomes',
    labelNames: ['template', 'result'] as const,
    registers: [this.registry],
  });
  private readonly mailDuration = new Histogram({
    name: METRIC_NAMES.MAIL_DURATION,
    help: 'Mail delivery duration in seconds',
    labelNames: ['template', 'result'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [this.registry],
  });
  private readonly smtpVerify = new Counter({
    name: METRIC_NAMES.MAIL_SMTP_VERIFY,
    help: 'SMTP verification outcomes',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly mediaUploads = new Counter({
    name: METRIC_NAMES.MEDIA_UPLOADS,
    help: 'Media upload outcomes',
    labelNames: ['resource_type', 'result'] as const,
    registers: [this.registry],
  });
  private readonly mediaCleanup = new Counter({
    name: METRIC_NAMES.MEDIA_CLEANUP,
    help: 'Media cleanup outcomes',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly webhookEvents = new Counter({
    name: METRIC_NAMES.CLOUDINARY_WEBHOOK_EVENTS,
    help: 'Cloudinary webhook processing outcomes',
    labelNames: ['event_type', 'result'] as const,
    registers: [this.registry],
  });
  private readonly webhookBacklog = new Gauge({
    name: METRIC_NAMES.CLOUDINARY_WEBHOOK_BACKLOG,
    help: 'Cloudinary webhook inbox backlog by status',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });
  private readonly webhookOldestPending = new Gauge({
    name: METRIC_NAMES.CLOUDINARY_WEBHOOK_OLDEST_PENDING,
    help: 'Age of the oldest pending Cloudinary webhook in seconds',
    registers: [this.registry],
  });
  private readonly cacheOperations = new Counter({
    name: METRIC_NAMES.CACHE_OPERATIONS,
    help: 'Cache operation outcomes',
    labelNames: ['operation', 'result'] as const,
    registers: [this.registry],
  });
  private readonly lockOperations = new Counter({
    name: METRIC_NAMES.LOCK_OPERATIONS,
    help: 'Distributed lock operation outcomes',
    labelNames: ['operation', 'result'] as const,
    registers: [this.registry],
  });
  private readonly lockWait = new Histogram({
    name: METRIC_NAMES.LOCK_WAIT,
    help: 'Distributed lock wait duration in seconds',
    labelNames: ['operation', 'result'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry],
  });
  private readonly idempotencyOperations = new Counter({
    name: METRIC_NAMES.IDEMPOTENCY_OPERATIONS,
    help: 'Idempotency store operation outcomes',
    labelNames: ['operation', 'result'] as const,
    registers: [this.registry],
  });
  private readonly redisErrors = new Counter({
    name: METRIC_NAMES.REDIS_ERRORS,
    help: 'Redis errors by bounded operation',
    labelNames: ['operation'] as const,
    registers: [this.registry],
  });
  private readonly dependencyHealth = new Gauge({
    name: METRIC_NAMES.DEPENDENCY_HEALTH,
    help: 'Dependency health (1 up/configured, 0 down, -1 disabled)',
    labelNames: ['dependency'] as const,
    registers: [this.registry],
  });

  constructor(configService: ConfigService) {
    const config =
      configService.getOrThrow<ObservabilityConfig>('observability');
    this.enabled = config.enabled && config.metrics.enabled;
    this.registry.setDefaultLabels({ service: config.serviceName });
    if (this.enabled && config.metrics.collectDefaultMetrics) {
      collectDefaultMetrics({ register: this.registry, prefix: 'qlt_nodejs_' });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpStart(method: string): void {
    if (this.enabled) this.activeHttp.inc({ method: normalizeMethod(method) });
  }

  recordHttpFinish(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }): void {
    if (!this.enabled) return;
    const labels = {
      method: normalizeMethod(input.method),
      route: input.route,
      status_code: normalizeStatusCode(input.statusCode),
    };
    this.activeHttp.dec({ method: labels.method });
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, Math.max(0, input.durationSeconds));
  }

  recordOutbox(
    eventType: string,
    result: OperationResult,
    seconds: number,
  ): void {
    if (!this.enabled) return;
    this.outboxEvents.inc({
      event_type: normalizeOutboxEvent(eventType),
      result,
    });
    this.outboxDuration.observe({ result }, Math.max(0, seconds));
  }

  recordOutboxStaleRecovered(count: number): void {
    if (this.enabled && count > 0) this.outboxStaleRecovered.inc(count);
  }

  setOutboxBacklog(
    counts: Record<OutboxStatusLabel, number>,
    oldestPendingAgeSeconds: number,
  ): void {
    if (!this.enabled) return;
    for (const status of ['pending', 'processing', 'failed'] as const) {
      this.outboxBacklog.set({ status }, counts[status]);
    }
    this.outboxOldestPending.set(Math.max(0, oldestPendingAgeSeconds));
  }

  setQueueSnapshot(input: {
    queue: QueueName;
    counts: Record<QueueState, number>;
    workers: number;
    oldestWaitingAgeSeconds: number;
  }): void {
    if (!this.enabled || !Object.values(QUEUE_NAMES).includes(input.queue))
      return;
    for (const state of ['waiting', 'active', 'delayed', 'failed'] as const) {
      this.queueJobs.set({ queue: input.queue, state }, input.counts[state]);
    }
    this.queueWorkers.set({ queue: input.queue }, input.workers);
    this.queueOldestWaiting.set(
      { queue: input.queue },
      Math.max(0, input.oldestWaitingAgeSeconds),
    );
  }

  recordMail(template: string, result: OperationResult, seconds: number): void {
    if (!this.enabled) return;
    const labels = { template: normalizeMailTemplate(template), result };
    this.mailDeliveries.inc(labels);
    this.mailDuration.observe(labels, Math.max(0, seconds));
  }

  recordSmtpVerify(result: 'success' | 'failed' | 'disabled'): void {
    if (this.enabled) this.smtpVerify.inc({ result });
  }

  recordMediaUpload(
    resourceType: 'image' | 'video' | 'raw',
    result: OperationResult,
  ): void {
    if (this.enabled)
      this.mediaUploads.inc({ resource_type: resourceType, result });
  }

  recordMediaCleanup(result: OperationResult): void {
    if (this.enabled) this.mediaCleanup.inc({ result });
  }

  recordWebhook(eventType: string | null, result: OperationResult): void {
    if (this.enabled) {
      this.webhookEvents.inc({
        event_type: normalizeCloudinaryEvent(eventType),
        result,
      });
    }
  }

  setWebhookBacklog(
    counts: { pending: number; failed: number; processing: number },
    oldestPendingAgeSeconds: number,
  ): void {
    if (!this.enabled) return;
    for (const status of ['pending', 'failed', 'processing'] as const) {
      this.webhookBacklog.set({ status }, counts[status]);
    }
    this.webhookOldestPending.set(Math.max(0, oldestPendingAgeSeconds));
  }

  recordCache(
    operation: 'get' | 'set' | 'delete' | 'delete_many',
    result: 'hit' | 'miss' | 'success' | 'failed' | 'disabled',
  ): void {
    if (this.enabled) this.cacheOperations.inc({ operation, result });
  }

  recordLock(
    operation: 'acquire' | 'extend' | 'release',
    result: 'success' | 'failed' | 'conflict' | 'ownership_lost',
    waitSeconds?: number,
  ): void {
    if (!this.enabled) return;
    this.lockOperations.inc({ operation, result });
    if (operation === 'acquire' && waitSeconds !== undefined) {
      this.lockWait.observe({ operation, result }, Math.max(0, waitSeconds));
    }
  }

  recordIdempotency(
    operation: 'acquire' | 'save_result' | 'mark_failed',
    result: 'success' | 'failed' | 'conflict' | 'replay' | 'disabled',
  ): void {
    if (this.enabled) this.idempotencyOperations.inc({ operation, result });
  }

  recordRedisError(
    operation: 'cache' | 'lock' | 'idempotency' | 'queue' | 'health',
  ): void {
    if (this.enabled) this.redisErrors.inc({ operation });
  }

  setDependencyHealth(
    dependency: 'database' | 'redis' | 'mail' | 'cloudinary' | 'queue',
    status: 'up' | 'down' | 'disabled' | 'configured',
  ): void {
    if (!this.enabled) return;
    this.dependencyHealth.set(
      { dependency },
      status === 'disabled' ? -1 : status === 'down' ? 0 : 1,
    );
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}

function normalizeMethod(method: string): string {
  const normalized = method.toUpperCase();
  return ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(
    normalized,
  )
    ? normalized
    : 'OTHER';
}

function normalizeStatusCode(statusCode: number): HttpStatusCode {
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
    ? `${statusCode}`
    : 'unknown';
}

function normalizeOutboxEvent(eventType: string): string {
  return eventType === 'mail.send.v1' ? eventType : 'unknown';
}

function normalizeMailTemplate(template: string): MailTemplate {
  const allowed: readonly MailTemplate[] = [
    'email-verification.v1',
    'password-reset.v1',
    'change-email.v1',
    'moderation-result.v1',
    'new-chapter.v1',
  ];
  return allowed.includes(template as MailTemplate)
    ? (template as MailTemplate)
    : 'unknown';
}

function normalizeCloudinaryEvent(
  eventType: string | null,
): CloudinaryEventType {
  const normalized = eventType?.toLowerCase() ?? 'unknown';
  const allowed: readonly CloudinaryEventType[] = [
    'upload',
    'resource_created',
    'resource_uploaded',
    'delete',
    'resource_deleted',
    'ping',
  ];
  return allowed.includes(normalized as CloudinaryEventType)
    ? (normalized as CloudinaryEventType)
    : 'unknown';
}
