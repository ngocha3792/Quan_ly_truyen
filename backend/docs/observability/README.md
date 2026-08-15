# Backend observability

The backend emits structured logs to stdout, Prometheus metrics from the protected `/internal/metrics` route, and OTLP traces. Business requests never call Loki or Tempo directly. Export failures are fail-open and must not change business outcomes.

## Run locally

1. Copy `.env.example` to the local environment and keep `METRICS_BEARER_TOKEN` aligned with the local Prometheus config.
2. Start the backend dependencies and API/worker.
3. Run `npm run observability:up`.
4. Open Grafana at `http://localhost:3001` (`admin` / `admin` for local use only).
5. Run `npm run observability:smoke`.

The checked-in token and Grafana password are local-only examples. Production must inject secrets and restrict `/internal/metrics` at the network boundary as well as using its bearer token.

## Log schema and privacy

Production logs are one JSON object per line. Every record has `service.name`, `service.version`, `deployment.environment`, and `service.instance.id`. When available, records also have top-level `requestId`, `correlationId`, `traceId`, and `spanId`. HTTP completion records use the stable event `http.request.completed` and route templates rather than raw URLs.

The sanitizer recursively redacts password/token/authorization/cookie/idempotency key, SMTP and Cloudinary credentials, reset tokens, raw bodies, email bodies, signatures, credential-bearing database/Redis/SMTP URLs, and bearer/JWT-looking values. Identifiers required for operations (for example outbox event ID and job ID) appear only in logs/spans, never metric labels. Do not log raw SQL parameters.

## Metrics

All labels have closed or normalized value sets:

- `qlt_http_server_requests_total{method,route,status_code}`
- `qlt_http_server_request_duration_seconds{method,route,status_code}`
- `qlt_http_server_active_requests{method}`
- `qlt_outbox_events_total{event_type,result}`, `qlt_outbox_dispatch_duration_seconds{result}`, `qlt_outbox_stale_recovered_total`, `qlt_outbox_backlog_events{status}`, `qlt_outbox_oldest_pending_age_seconds`
- `qlt_queue_jobs{queue,state}`, `qlt_queue_workers{queue}`, `qlt_queue_oldest_waiting_age_seconds{queue}`
- `qlt_mail_deliveries_total{template,result}`, `qlt_mail_delivery_duration_seconds{template,result}`, `qlt_mail_smtp_verify_total{result}`
- `qlt_media_uploads_total{resource_type,result}`, `qlt_media_cleanup_total{result}`
- `qlt_cloudinary_webhook_events_total{event_type,result}`, `qlt_cloudinary_webhook_backlog_events{status}`, `qlt_cloudinary_webhook_oldest_pending_age_seconds`
- `qlt_cache_operations_total{operation,result}`, `qlt_distributed_lock_operations_total{operation,result}`, `qlt_distributed_lock_wait_duration_seconds{operation,result}`, `qlt_idempotency_operations_total{operation,result}`, `qlt_redis_errors_total{operation}`, `qlt_dependency_health{dependency}`
- `qlt_nodejs_*` process/runtime metrics from `prom-client`

Forbidden labels include request, trace, user, story, chapter, job, and outbox IDs; raw URL; error message; and any entity-specific value. Queue and database backlog snapshots are cached by timers, not queried during Prometheus scrape.

## Traces and propagation

Automatic spans cover inbound HTTP, PostgreSQL/Prisma (`@prisma/instrumentation`), Redis, and supported Node libraries. Manual spans are `outbox.dispatch_batch`, `outbox.publish_event`, and `mail.dispatch`. BullMQ producer/consumer spans are created by `bullmq-otel`; application code does not duplicate them.

Flow: HTTP active W3C context → business transaction → outbox `metadata.traceCarrier` plus `correlationId`/`causationId` → dispatcher extracts it → BullMQ injects its carrier while the envelope keeps correlation metadata → worker extracts both into the existing `RequestContextStore`. Retry reuses the same envelope. Only `traceparent` and `tracestate` are persisted; baggage is deliberately excluded for privacy. Delivery remains at-least-once, including SMTP.

OpenTelemetry is started by dynamic import in `main.ts`/`worker.ts` before importing AppModule, WorkerModule, Prisma Client, BullMQ, Express, or other instrumented libraries. Set `OTEL_SDK_DISABLED=true` to disable export without preventing bootstrap.

## Dashboards and alerts

Provisioned dashboards are API Overview, Queue and Outbox, Infrastructure, and Recovery Readiness. Prometheus sends alerts to Alertmanager; production Alertmanager reads its HTTPS receiver URL from the ignored `ops/production/secrets/alert_webhook_url` file. Alerts cover API/dependency availability, 5xx ratio, P95 latency, queue/worker health, outbox/mail/webhook/Redis failures, observability component availability, backup RPO, encrypted off-site verification, and restore-drill freshness. Each alert links to the relevant operational dashboard. Treat latency/error thresholds as initial baselines and tune them from production observations before defining SLOs.

## Version-specific API notes

This implementation follows installed APIs rather than older snippets: OpenTelemetry `NodeSDK.start()` and `prom-client.collectDefaultMetrics()` return `void` in the installed versions. `@nestjs/bullmq` forwards root queue `telemetry` options to queues and workers, so one `BullMQOtel` instance is configured at the root; adding manual queue spans would duplicate spans.

## Troubleshooting

- No metrics: verify `METRICS_ENABLED`, bearer token, target address, and Prometheus target status.
- No traces: verify Alloy on ports 4317/4318 and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces`.
- No host-process logs in Loki: Alloy discovers Docker containers. Run the backend in Docker or configure an environment-specific stdout collector; never add a Loki HTTP call to application code.
- Collector unavailable: business traffic should continue; inspect `telemetry.bootstrap.failed` and collector health.
- Recovery dashboard red: inspect `backup-last-success.json` and `restore-drill/restore-drill-last-success.json`, then run `Test-RecoveryReadiness.ps1`.
- Alerts visible in Prometheus but no notification delivered: verify Alertmanager status and the ignored webhook secret file; never place the webhook URL in Git.
