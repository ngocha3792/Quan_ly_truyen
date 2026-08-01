# HƯỚNG DẪN TRIỂN KHAI OBSERVABILITY CHO QUẢN LÝ TRUYỆN

> Phạm vi: `backend` NestJS 11, Prisma 7, PostgreSQL, Redis, BullMQ, Cloudinary, Nodemailer.
>
> Mục tiêu: triển khai observability đủ dùng cho production nhiều instance nhưng không làm business code phụ thuộc vào Grafana, Loki, Tempo hay một vendor cụ thể.

---

## 1. Trạng thái hiện tại của dự án

Dự án đã có một số nền tảng tốt và phải tái sử dụng:

- `RequestContextMiddleware` tạo `requestId` và `correlationId`.
- `RequestContextStore` sử dụng `AsyncLocalStorage`.
- `LoggingInterceptor` ghi method, path, status và thời gian xử lý.
- `AllExceptionsFilter` chịu trách nhiệm ghi lỗi HTTP, tránh log trùng với interceptor.
- Event metadata đã có `correlationId`, `causationId`, `traceId`.
- Mail message đã hỗ trợ `correlationId`.
- Health có `/health/live`, `/health/ready` và diagnostics có phân quyền.
- Outbox, BullMQ worker, Cloudinary webhook worker đã có ranh giới tương đối rõ.
- `src/common/interfaces/observability` đã có `LogContext`, `TraceContext`, `ExecutionMetadata`.

Không được tạo một request-context system thứ hai. Phần observability mới phải mở rộng các thành phần trên.

---

## 2. Kiến trúc được đề xuất

```text
API / Worker
│
├── Structured logs (Pino JSON → stdout)
│                           │
│                           └── Grafana Alloy / container log collector → Loki
│
├── Metrics (/internal/metrics, Prometheus format)
│                           │
│                           └── Prometheus → Grafana
│
└── Traces (OpenTelemetry OTLP)
                            │
                            └── Alloy hoặc OTel Collector → Tempo → Grafana
```

Stack local đề xuất:

- **Logs:** Pino + Loki.
- **Metrics:** `prom-client` + Prometheus.
- **Traces:** OpenTelemetry SDK + Tempo.
- **Collector:** Grafana Alloy hoặc OpenTelemetry Collector.
- **Dashboard/alert:** Grafana.
- **Error tracking:** chưa cần thêm Sentry ở phase đầu. Có thể bổ sung sau nếu cần issue grouping và release tracking chuyên sâu.

### Nguyên tắc quan trọng

1. Ứng dụng chỉ:
   - ghi JSON ra stdout;
   - expose metrics;
   - gửi OTLP đến collector.
2. Ứng dụng không gọi trực tiếp Loki API.
3. Collector chịu trách nhiệm retry, batch, routing và đổi backend.
4. Không đưa dữ liệu có cardinality cao vào metric labels.
5. Không log password, token, cookie, authorization header, SMTP credential, Cloudinary secret hoặc nội dung email nhạy cảm.
6. `requestId`, `correlationId`, `traceId` phải xuất hiện xuyên suốt HTTP → outbox → BullMQ → worker → mail/media.

---

# PHASE 0 — CẤU HÌNH VÀ CẤU TRÚC FOLDER

## 3. Package cần cài

Chạy trong `backend`:

```bash
npm install \
  pino \
  prom-client \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-proto \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @prisma/instrumentation \
  bullmq-otel

npm install --save-dev pino-pretty
```

Không sử dụng `@latest` trong command được commit vào tài liệu CI. Sau khi cài, giữ lockfile để pin dependency tree.

## 4. Cấu trúc folder đề xuất

```text
src/
├── instrumentation.ts
├── observability/
│   ├── observability.module.ts
│   ├── index.ts
│   ├── logging/
│   │   ├── app-logger.service.ts
│   │   ├── log-sanitizer.ts
│   │   └── logging.constants.ts
│   ├── metrics/
│   │   ├── metrics.controller.ts
│   │   ├── metrics.guard.ts
│   │   ├── metrics.service.ts
│   │   ├── http-metrics.interceptor.ts
│   │   └── metric-names.constants.ts
│   └── tracing/
│       ├── tracing.service.ts
│       ├── trace-propagation.service.ts
│       └── tracing.constants.ts
└── config/
    └── observability.config.ts
```

Infrastructure-specific instruments vẫn đặt gần adapter của chúng, ví dụ:

```text
src/infrastructure/queue/observability/
src/infrastructure/mail/observability/
src/infrastructure/media/observability/
```

Không gom toàn bộ business-specific metrics vào một file khổng lồ.

## 5. Cấu hình environment

Thêm vào `.env.example`:

```env
# Observability
OBSERVABILITY_ENABLED=true
LOG_LEVEL=debug
LOG_PRETTY=true
LOG_INCLUDE_SOURCE=false

METRICS_ENABLED=true
METRICS_PATH=/internal/metrics
METRICS_BEARER_TOKEN=replace-with-a-long-random-token
METRICS_DEFAULT_ENABLED=true

OTEL_SDK_DISABLED=false
OTEL_SERVICE_NAME=quan-ly-truyen-api
OTEL_SERVICE_VERSION=0.0.1
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0
OTEL_BSP_EXPORT_TIMEOUT=3000
OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512
OTEL_BSP_SCHEDULE_DELAY=5000
```

Production gợi ý:

```env
LOG_LEVEL=info
LOG_PRETTY=false
LOG_INCLUDE_SOURCE=false

OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.10
```

Worker phải dùng service name riêng:

```env
OTEL_SERVICE_NAME=quan-ly-truyen-worker
```

Có thể dùng cùng image nhưng inject biến khác ở deployment API và worker.

### 5.1 Thêm config type

Trong `src/config/config.types.ts`:

```ts
export interface ObservabilityConfig {
  enabled: boolean;
  log: {
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
    pretty: boolean;
    includeSource: boolean;
  };
  metrics: {
    enabled: boolean;
    path: string;
    bearerToken?: string;
    collectDefaultMetrics: boolean;
  };
}
```

Các biến `OTEL_*` nên để OpenTelemetry SDK đọc theo convention chuẩn. Không cần copy toàn bộ chúng vào Nest `ConfigService` trừ khi code application thực sự cần.

### 5.2 Validation bắt buộc

Thêm validation cho:

- `OBSERVABILITY_ENABLED`.
- `LOG_LEVEL` enum.
- `LOG_PRETTY`.
- `LOG_INCLUDE_SOURCE`.
- `METRICS_ENABLED`.
- `METRICS_PATH` phải bắt đầu bằng `/`.
- `METRICS_BEARER_TOKEN` optional ở development nhưng bắt buộc trong production nếu endpoint không được network policy bảo vệ.
- `METRICS_DEFAULT_ENABLED`.

Không validate secret bằng cách log giá trị invalid ra console.

---

# PHASE 1 — STRUCTURED LOGGING

## 6. Thay logger text bằng JSON logger

Nest cho phép thay global logger bằng implementation của `LoggerService`. Dùng Pino làm engine nhưng giữ API `Logger` hiện có để không phải sửa tất cả class ngay lập tức.

### 6.1 Yêu cầu đối với `AppLoggerService`

`AppLoggerService` phải:

- implement `LoggerService`;
- ghi mỗi event thành một JSON object trên một dòng;
- tự thêm:
  - `timestamp`;
  - `level`;
  - `service.name`;
  - `service.version`;
  - `deployment.environment`;
  - `service.instance.id`;
  - `context` của Nest logger;
  - `requestId`;
  - `correlationId`;
  - `traceId`;
  - `spanId`;
- đọc request context từ `RequestContextStore`;
- đọc trace/span đang active từ OpenTelemetry API;
- xử lý đúng `Error` object;
- không stringify Error thành `{}`;
- không throw nếu telemetry context không tồn tại;
- flush khi shutdown.

Skeleton:

```ts
import { context, trace } from '@opentelemetry/api';
import { Injectable, LoggerService } from '@nestjs/common';
import pino, { type Logger as PinoLogger } from 'pino';

import { RequestContextStore } from '@/common/middlewares';

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly root: PinoLogger;

  constructor(private readonly requestContext: RequestContextStore) {
    this.root = pino({
      level: process.env.LOG_LEVEL ?? 'info',
      base: {
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-api',
        'service.version': process.env.OTEL_SERVICE_VERSION ?? 'unknown',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
        'service.instance.id':
          process.env.SERVICE_INSTANCE_ID ?? process.pid.toString(),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          'password',
          '*.password',
          'token',
          '*.token',
          'accessToken',
          'refreshToken',
          'authorization',
          '*.authorization',
          'cookie',
          '*.cookie',
          'smtp.password',
          'cloudinary.apiSecret',
        ],
        censor: '[REDACTED]',
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const request = this.requestContext.get();
    const activeSpan = trace.getSpan(context.active());
    const spanContext = activeSpan?.spanContext();

    const nestContext = this.extractNestContext(optionalParams);
    const error = this.extractError(message, optionalParams);
    const fields =
      message && typeof message === 'object' && !(message instanceof Error)
        ? message
        : {};

    this.root[level](
      {
        ...fields,
        ...(nestContext ? { context: nestContext } : {}),
        ...(request?.requestId ? { requestId: request.requestId } : {}),
        ...(request?.correlationId
          ? { correlationId: request.correlationId }
          : {}),
        ...(request?.userId ? { userId: request.userId } : {}),
        ...(spanContext?.traceId ? { traceId: spanContext.traceId } : {}),
        ...(spanContext?.spanId ? { spanId: spanContext.spanId } : {}),
        ...(error ? { err: error } : {}),
      },
      typeof message === 'string' ? message : undefined,
    );
  }

  // Tự triển khai extractNestContext và extractError, có unit test.
}
```

Đây là skeleton định hướng, không copy mù quáng. `LoggerService` optional params của Nest có nhiều dạng; phải viết test cho message string, object, Error, stack và context.

### 6.2 Pretty log chỉ dùng development

Pino pretty transport chỉ bật khi:

```text
NODE_ENV != production && LOG_PRETTY=true
```

Không pretty-print ở production vì:

- tăng CPU;
- phá JSON parsing;
- làm collector khó xử lý field.

Transport phải chạy worker thread theo khuyến nghị của Pino.

### 6.3 Đăng ký logger toàn cục

Trong bootstrap:

```ts
const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
  rawBody: true,
});

app.useLogger(app.get(AppLoggerService));
app.flushLogs();
```

Worker context:

```ts
const app = await NestFactory.createApplicationContext(WorkerModule, {
  bufferLogs: true,
});

app.useLogger(app.get(AppLoggerService));
app.flushLogs();
```

`ObservabilityModule` nên là global module hoặc được import trực tiếp bởi cả `AppModule` và `WorkerModule`.

## 7. Chuẩn hóa schema log

Mỗi log nghiệp vụ phải có `event` ổn định.

Ví dụ HTTP thành công:

```json
{
  "level": 30,
  "event": "http.request.completed",
  "http.method": "GET",
  "http.route": "/api/v1/stories/:id",
  "http.status_code": 200,
  "duration_ms": 23.41,
  "requestId": "...",
  "correlationId": "...",
  "traceId": "...",
  "controller": "StoriesController",
  "handler": "findOne"
}
```

Ví dụ lỗi:

```json
{
  "level": 50,
  "event": "http.request.failed",
  "http.method": "POST",
  "http.route": "/api/v1/auth/register",
  "http.status_code": 500,
  "error.code": "INTERNAL_SERVER_ERROR",
  "requestId": "...",
  "traceId": "...",
  "err": {
    "type": "Error",
    "message": "...",
    "stack": "..."
  }
}
```

### Field bắt buộc theo nhóm

HTTP:

- `event`
- `http.method`
- `http.route`
- `http.status_code`
- `duration_ms`
- `requestId`
- `correlationId`
- `traceId` nếu có

Queue:

- `event`
- `messaging.system = bullmq`
- `messaging.destination.name`
- `messaging.operation.name`
- `job.id`
- `job.name`
- `job.attempt`
- `outboxEventId` nếu có
- `correlationId`
- `traceId`
- `duration_ms`

Outbox:

- `event`
- `outbox.event_id`
- `outbox.event_type`
- `outbox.aggregate_type`
- `outbox.attempt`
- `outbox.result`

Mail:

- không log recipient đầy đủ;
- có thể log `recipient_domain`;
- log `messageId`, `template`, `result`;
- không log subject/body nếu chứa dữ liệu người dùng.

Media:

- log asset ID/public ID sau khi sanitize;
- không log signed URL đầy đủ nếu có token/query secret.

## 8. Sửa `LoggingInterceptor`

Không tiếp tục build chuỗi:

```text
GET /path status=200 durationMs=...
```

Thay bằng structured event object.

Quan trọng:

- label/log field `http.route` phải là route template, ví dụ `/stories/:id`;
- không dùng raw URL `/stories/812935` làm metric label;
- raw path chỉ được log nếu đã loại query string và xác nhận không chứa PII;
- không log request body mặc định;
- `/health/live`, `/health/ready`, metrics endpoint nên skip access log hoặc sample mạnh.

## 9. Sửa `AllExceptionsFilter`

Khi gặp lỗi:

1. normalize exception như hiện tại;
2. ghi structured log;
3. lấy active span;
4. gọi `recordException()` nếu là Error;
5. set span status thành error;
6. không trả stack cho client;
7. không log cùng lỗi ở interceptor.

Ví dụ:

```ts
import {
  context,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

const span = trace.getSpan(context.active());

if (span) {
  if (exception instanceof Error) {
    span.recordException(exception);
  }

  span.setAttributes({
    'error.type': normalized.code,
    'http.response.status_code': normalized.status,
  });

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: normalized.code,
  });
}
```

Không đưa exception details chứa email, token hoặc raw SQL vào span attributes.

## 10. Log sanitizer

Tạo `log-sanitizer.ts` để xử lý cả object và chuỗi.

Phải che:

- `postgresql://user:password@host/...`
- `redis://user:password@host/...`
- `rediss://user:password@host/...`
- `smtp://...`
- bearer token;
- JWT;
- cookie;
- signed Cloudinary query;
- email nếu policy yêu cầu pseudonymization.

Không mutate object gốc.

Thêm giới hạn:

- độ sâu object;
- số lượng key;
- độ dài string;
- độ dài stack;
- xử lý circular reference.

---

# PHASE 2 — METRICS

## 11. Metric naming và cardinality

Prefix project:

```text
qlt_
```

Tên metric phải có unit/type rõ ràng:

```text
qlt_http_server_requests_total
qlt_http_server_request_duration_seconds
qlt_http_server_active_requests
qlt_outbox_events_total
qlt_outbox_dispatch_duration_seconds
qlt_outbox_backlog_events
qlt_mail_deliveries_total
qlt_cloudinary_webhook_events_total
```

### Không bao giờ dùng các field sau làm metric label

- `requestId`
- `correlationId`
- `traceId`
- `userId`
- `storyId`
- `chapterId`
- `jobId`
- `outboxEventId`
- email
- raw URL
- error message
- Cloudinary public ID

Các field này chỉ dùng trong logs/traces.

### Label hợp lệ

- HTTP method.
- Route template.
- Status class hoặc status code hữu hạn.
- Queue name hữu hạn.
- Job name nếu job name được khai báo bằng constant hữu hạn.
- Result: `success`, `failed`, `retry`, `skipped`, `ownership_lost`.
- Error code do ứng dụng kiểm soát.

## 12. `MetricsService`

Dùng một `Registry` riêng thay vì registry global mặc định để test và tránh đăng ký trùng khi Nest test module được tạo nhiều lần.

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'qlt_http_server_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'qlt_http_server_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly activeHttpRequests = new Gauge({
    name: 'qlt_http_server_active_requests',
    help: 'Current active HTTP requests',
    labelNames: ['method'] as const,
    registers: [this.registry],
  });

  private readonly stopDefaultMetrics?: () => void;

  constructor() {
    if (process.env.METRICS_DEFAULT_ENABLED !== 'false') {
      this.stopDefaultMetrics = collectDefaultMetrics({
        register: this.registry,
        prefix: 'qlt_nodejs_',
      });
    }
  }

  onModuleDestroy(): void {
    this.stopDefaultMetrics?.();
    this.registry.clear();
  }
}
```

Lưu ý: kiểm tra API thực tế của version `prom-client` đã cài trước khi hoàn thiện lifecycle.

## 13. HTTP metrics interceptor

Tạo interceptor riêng hoặc hợp nhất có kiểm soát với `LoggingInterceptor`.

Khuyến nghị giữ riêng trách nhiệm:

- `LoggingInterceptor`: logs.
- `HttpMetricsInterceptor`: metrics.

Flow:

1. resolve method và route template;
2. active requests `inc`;
3. start timer;
4. finalize:
   - active requests `dec`;
   - counter `inc`;
   - histogram `observe`;
5. status lỗi phải lấy từ response sau exception filter hoặc normalize lỗi trong interceptor.

Nếu khó lấy status cuối khi exception xảy ra, dùng middleware trên event `response.finish`/`response.close`, vì lúc đó `statusCode` đã ổn định.

Không thu metric cho chính metrics endpoint.

## 14. Metrics endpoint

Tạo endpoint:

```text
GET /internal/metrics
```

Yêu cầu:

- `@SkipResponseEnvelope()`.
- không đi qua response transformer.
- trả content type từ `registry.contentType`.
- không expose trên public ingress nếu có thể.
- hỗ trợ `Authorization: Bearer <METRICS_BEARER_TOKEN>`.
- production phải dùng constant-time comparison cho token.
- không ghi token vào log.
- health vẫn tách riêng, không trộn metrics vào `/health`.

Pseudo-code:

```ts
@Get()
async getMetrics(@Res() response: Response): Promise<void> {
  response.setHeader('Content-Type', this.metrics.registry.contentType);
  response.send(await this.metrics.registry.metrics());
}
```

## 15. Metrics bắt buộc theo subsystem

### 15.1 HTTP

```text
qlt_http_server_requests_total{method,route,status_code}
qlt_http_server_request_duration_seconds{method,route,status_code}
qlt_http_server_active_requests{method}
```

### 15.2 Outbox

```text
qlt_outbox_events_total{event_type,result}
qlt_outbox_dispatch_duration_seconds{result}
qlt_outbox_stale_recovered_total
qlt_outbox_backlog_events{status}
qlt_outbox_oldest_pending_age_seconds
```

`backlog` và `oldest age` nên được cập nhật bởi scheduled observer, không query DB trên mỗi scrape nếu query tốn kém.

### 15.3 BullMQ

Ưu tiên dùng `bullmq-otel` vì BullMQ đã có telemetry interface.

Bật:

```ts
const telemetry = new BullMQOtel({
  tracerName: process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-worker',
  meterName: process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-worker',
  version: process.env.OTEL_SERVICE_VERSION ?? 'unknown',
  enableMetrics: true,
});
```

Truyền cùng telemetry provider vào Queue và Worker options.

Ngoài metric tự động của BullMQ, vẫn cần gauge backlog theo queue/state:

```text
qlt_queue_jobs{queue,state}
qlt_queue_workers{queue}
qlt_queue_oldest_waiting_age_seconds{queue}
```

Không gọi Redis quá nhiều trong mỗi Prometheus scrape. Cache snapshot 5–15 giây.

### 15.4 Mail

```text
qlt_mail_deliveries_total{template,result}
qlt_mail_delivery_duration_seconds{template,result}
qlt_mail_smtp_verify_total{result}
```

Không có label recipient/email.

### 15.5 Cloudinary/media

```text
qlt_media_uploads_total{resource_type,result}
qlt_media_cleanup_total{result}
qlt_cloudinary_webhook_events_total{event_type,result}
qlt_cloudinary_webhook_backlog_events{status}
qlt_cloudinary_webhook_oldest_pending_age_seconds
```

### 15.6 Redis/cache/lock/idempotency

```text
qlt_cache_operations_total{operation,result}
qlt_distributed_lock_operations_total{operation,result}
qlt_distributed_lock_wait_duration_seconds{operation,result}
qlt_idempotency_operations_total{operation,result}
qlt_redis_errors_total{operation}
```

Không dùng Redis key làm label.

### 15.7 Database

Theo dõi tối thiểu qua traces và database exporter bên ngoài.

Không thêm model name/query text tùy ý vào Prometheus labels.

Có thể thêm:

```text
qlt_database_operations_total{operation,result}
qlt_database_operation_duration_seconds{operation,result}
```

nhưng `operation` phải là tập hữu hạn do code định nghĩa, không phải raw SQL.

---

# PHASE 3 — DISTRIBUTED TRACING

## 16. Instrumentation phải chạy trước application imports

Đây là yêu cầu bắt buộc. OpenTelemetry phải patch HTTP, Express, Prisma, pg, ioredis trước khi các package đó được load.

Không làm:

```ts
import { AppModule } from './app.module';
import './instrumentation';
```

### 16.1 Entry point đúng

Nếu dự án đã có `load-environment.ts`, dùng flow:

```ts
// src/main.ts
import { loadEnvironment } from './bootstrap/load-environment';

async function main(): Promise<void> {
  loadEnvironment();

  const { startTelemetry } = await import('./instrumentation');
  await startTelemetry();

  const { runApplication } = await import('./bootstrap');
  await runApplication();
}

void main();
```

Worker tương tự:

```ts
// src/worker.ts
import { loadEnvironment } from './bootstrap/load-environment';

async function main(): Promise<void> {
  loadEnvironment();

  const { startTelemetry } = await import('./instrumentation');
  await startTelemetry();

  const { runWorker } = await import('./bootstrap/worker.bootstrap');
  await runWorker();
}

void main();
```

Không import `AppModule`, `WorkerModule`, Prisma, BullMQ hoặc Nest bootstrap trước `startTelemetry()`.

## 17. `instrumentation.ts`

Skeleton:

```ts
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export async function startTelemetry(): Promise<void> {
  if (process.env.OTEL_SDK_DISABLED === 'true') return;

  const sampleRatio = parseSampleRatio(
    process.env.OTEL_TRACES_SAMPLER_ARG ?? '1',
  );

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-api',
      [ATTR_SERVICE_VERSION]:
        process.env.OTEL_SERVICE_VERSION ?? 'unknown',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        process.env.NODE_ENV ?? 'development',
      'service.instance.id':
        process.env.SERVICE_INSTANCE_ID ?? process.pid.toString(),
    }),
    traceExporter: new OTLPTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        'http://localhost:4318/v1/traces',
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(sampleRatio),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) => {
            const url = request.url ?? '';
            return (
              url.includes('/health/live') ||
              url.includes('/internal/metrics')
            );
          },
        },
      }),
      new PrismaInstrumentation(),
    ],
  });

  await sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}

function parseSampleRatio(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
}
```

Kiểm tra API chính xác theo version OpenTelemetry được cài. Không dùng snippet nếu TypeScript type không khớp.

## 18. Graceful shutdown telemetry

Không tự đăng ký `process.exit()` bên trong instrumentation vì dự án đã có shutdown lifecycle.

Tạo provider/lifecycle service:

```ts
@Injectable()
export class TelemetryLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}
```

Phải bảo đảm thứ tự shutdown:

1. stop nhận request/job mới;
2. chờ request/job đang chạy;
3. flush logger;
4. shutdown OTel SDK;
5. đóng Redis/Prisma;
6. process kết thúc.

Nếu lifecycle thực tế của Nest không bảo đảm thứ tự provider như mong muốn, quản lý shutdown ở bootstrap bằng một coordinator rõ ràng.

## 19. Span naming

HTTP auto instrumentation tự tạo server span. Không tạo thêm một root HTTP span trong interceptor.

Manual span chỉ dùng cho operation quan trọng:

```text
story.create
chapter.publish
user.register
outbox.dispatch_batch
outbox.publish_event
mail.dispatch
cloudinary.webhook.process
media.cleanup
idempotency.acquire
lock.acquire
```

Tên span phải ổn định, không chứa ID:

Đúng:

```text
story.find_by_id
```

Sai:

```text
story.find_by_id.9d3e1...
```

## 20. `TracingService`

Tạo wrapper nhỏ để business code không import OTel API khắp nơi.

```ts
@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer(
    process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen',
    process.env.OTEL_SERVICE_VERSION ?? 'unknown',
  );

  async inSpan<T>(
    name: string,
    attributes: Attributes,
    work: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await work(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: unknown) {
        if (error instanceof Error) span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

Không đưa service object, DTO hoặc payload lớn vào attributes.

## 21. Prisma tracing

Dùng `@prisma/instrumentation` thay vì tự log raw SQL.

Yêu cầu:

- instrumentation được khởi tạo trước Prisma Client;
- không log query params chứa dữ liệu người dùng;
- sampling production phù hợp;
- kiểm tra chi phí span volume;
- nếu dùng SQL commenter trace context, đánh giá ảnh hưởng log/query monitoring trước khi bật.

## 22. BullMQ trace propagation

Ưu tiên tích hợp `bullmq-otel` vào cả:

- Queue producer;
- BullMQ Worker.

Nếu Nest BullMQ wrapper không expose trực tiếp telemetry option ở vị trí cần thiết, tạo shared factory cho queue connection/options.

Ngoài native telemetry, job payload/envelope vẫn phải mang metadata nghiệp vụ:

```ts
interface QueueTelemetryMetadata {
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  actorId?: string;
}
```

Không chỉ lưu `traceId`. Chuẩn W3C cần trace context đầy đủ nếu tự propagate:

```ts
interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
}
```

Khuyến nghị dùng OTel `propagation.inject()` khi enqueue và `propagation.extract()` khi process, không tự ghép `traceparent` bằng string.

### Producer

```ts
const carrier: Record<string, string> = {};
propagation.inject(context.active(), carrier);

await queue.add(jobName, {
  ...payload,
  telemetry: carrier,
  correlationId,
  causationId: outboxEventId,
});
```

### Consumer

```ts
const parentContext = propagation.extract(
  ROOT_CONTEXT,
  job.data.telemetry ?? {},
);

await context.with(parentContext, async () => {
  await tracer.startActiveSpan(
    `queue.process ${job.name}`,
    async (span) => {
      try {
        await processJob(job);
      } finally {
        span.end();
      }
    },
  );
});
```

Nếu `bullmq-otel` đã quản lý propagation thì không tạo span trùng. Chỉ thêm attributes/business events vào active span.

## 23. Outbox propagation

Khi tạo outbox event trong transaction business, lưu metadata:

```json
{
  "correlationId": "...",
  "causationId": "...",
  "traceparent": "...",
  "tracestate": "...",
  "actorId": "...",
  "source": "api",
  "schemaVersion": 1
}
```

Nếu Prisma schema hiện chưa có `metadata`, chọn một trong hai:

1. thêm column `metadata JSONB` vào `outbox_events`; hoặc
2. chuẩn hóa `payload.metadata` có schema/version rõ ràng.

Khuyến nghị column riêng để payload nghiệp vụ không bị trộn với transport metadata.

Outbox dispatcher phải copy metadata sang BullMQ envelope.

## 24. External calls

Auto instrumentation có thể cover `http`/`https`, nhưng vẫn thêm semantic attributes cho:

- Cloudinary upload/delete/admin API;
- SMTP send;
- external API sau này.

Không ghi URL chứa signed query/token. Chỉ ghi host và operation.

Ví dụ:

```text
server.address = api.cloudinary.com
rpc.system = smtp
messaging.message.id = deterministic mail message ID
```

Không đưa email recipient vào span attribute.

---

# PHASE 4 — LOCAL OBSERVABILITY STACK

## 25. Không nhồi production topology vào app compose hiện tại

Giữ `docker-compose.yml` hiện tại cho Postgres/Redis/Mailpit hoặc mở rộng bằng profile `observability`.

Đề xuất thêm:

```text
ops/observability/
├── docker-compose.observability.yml
├── prometheus/
│   ├── prometheus.yml
│   └── alerts.yml
├── loki/
│   └── config.yml
├── tempo/
│   └── config.yml
├── alloy/
│   └── config.alloy
└── grafana/
    ├── provisioning/
    │   ├── datasources/
    │   └── dashboards/
    └── dashboards/
```

## 26. Services local tối thiểu

```yaml
services:
  prometheus:
    image: prom/prometheus:<PINNED_VERSION>
    command:
      - --config.file=/etc/prometheus/prometheus.yml
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
    ports:
      - '9090:9090'

  loki:
    image: grafana/loki:<PINNED_VERSION>
    command: -config.file=/etc/loki/config.yml
    volumes:
      - ./loki/config.yml:/etc/loki/config.yml:ro
    ports:
      - '3100:3100'

  tempo:
    image: grafana/tempo:<PINNED_VERSION>
    command: -config.file=/etc/tempo/config.yml
    volumes:
      - ./tempo/config.yml:/etc/tempo/config.yml:ro
    ports:
      - '3200:3200'
      - '4317:4317'
      - '4318:4318'

  grafana:
    image: grafana/grafana:<PINNED_VERSION>
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - '3001:3000'

  alloy:
    image: grafana/alloy:<PINNED_VERSION>
    command: run /etc/alloy/config.alloy
    volumes:
      - ./alloy/config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - '12345:12345'
      - '4317:4317'
      - '4318:4318'
```

Không copy nguyên snippet này nếu port OTLP bị trùng giữa Tempo và Alloy. Chọn một ingress duy nhất:

- App → Alloy 4317/4318 → Tempo; hoặc
- App → OTel Collector → Tempo.

Khuyến nghị App → Alloy.

## 27. Prometheus scrape config

Nếu backend chạy ngoài compose:

```yaml
scrape_configs:
  - job_name: quan-ly-truyen-api
    metrics_path: /internal/metrics
    static_configs:
      - targets: ['host.docker.internal:3000']
    authorization:
      type: Bearer
      credentials: replace-with-dev-token
```

Nếu backend chạy trong compose, dùng service DNS thay `host.docker.internal`.

Không commit production token vào repository. Dùng secret file hoặc secret manager.

## 28. Datasources Grafana

Provision ba datasource:

- Prometheus.
- Loki.
- Tempo.

Cấu hình derived fields trong Loki để click `traceId` từ log sang Tempo.

Log phải có `traceId` ở top-level JSON hoặc structured metadata dễ query.

Tempo nên liên kết về Loki logs bằng trace ID và về Prometheus metrics nếu dùng exemplars/span metrics.

---

# PHASE 5 — DASHBOARD

## 29. Dashboard 1: API Overview

Panels tối thiểu:

- Requests/second.
- Error rate 5xx.
- P50/P95/P99 latency.
- Active requests.
- Top slow routes.
- Status code distribution.
- Node.js heap used.
- Event loop lag.
- Process CPU.
- Process restarts.

PromQL ví dụ:

### Request rate

```promql
sum(rate(qlt_http_server_requests_total[5m]))
```

### 5xx error ratio

```promql
sum(rate(qlt_http_server_requests_total{status_code=~"5.."}[5m]))
/
sum(rate(qlt_http_server_requests_total[5m]))
```

### P95 latency

```promql
histogram_quantile(
  0.95,
  sum by (le, route) (
    rate(qlt_http_server_request_duration_seconds_bucket[5m])
  )
)
```

Nếu dùng Prometheus native histograms thì query thay đổi theo loại metric thực tế.

## 30. Dashboard 2: Queue and Outbox

Panels:

- Pending outbox count.
- Oldest pending outbox age.
- Outbox publish success/failure/retry.
- Stale recovery count.
- Queue waiting/active/delayed/failed.
- Job throughput.
- Job P95 duration.
- Worker count.
- Mail sent/failed/skipped.

## 31. Dashboard 3: Infrastructure

Panels:

- Database health.
- Redis health/errors.
- Cache hit/miss nếu có.
- Lock contention.
- Idempotency conflicts/replays.
- Cloudinary webhook backlog.
- Memory and event-loop lag.

## 32. Dashboard 4: Product/Business

Chỉ thêm sau khi hệ thống technical metrics ổn định.

Ví dụ:

```text
qlt_user_registrations_total{result}
qlt_story_creations_total{result}
qlt_chapter_publications_total{result}
qlt_story_reads_total{source}
```

Không dùng story ID hoặc author ID làm labels.

Business metric phải được định nghĩa cùng product owner, không tự suy diễn từ log.

---

# PHASE 6 — ALERTING VÀ SLO

## 33. Alert tối thiểu

### API unavailable

```promql
up{job="quan-ly-truyen-api"} == 0
```

For: 2 phút.

### High 5xx ratio

```promql
(
  sum(rate(qlt_http_server_requests_total{status_code=~"5.."}[5m]))
  /
  sum(rate(qlt_http_server_requests_total[5m]))
) > 0.05
```

For: 10 phút, có minimum traffic condition để tránh alert khi mẫu quá nhỏ.

### High P95 latency

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(qlt_http_server_request_duration_seconds_bucket[5m])
  )
) > 1
```

For: 10 phút.

### Outbox stuck

```promql
qlt_outbox_oldest_pending_age_seconds > 300
```

For: 5 phút.

### Failed outbox exists

```promql
qlt_outbox_backlog_events{status="failed"} > 0
```

Warning trước, critical nếu tăng liên tục hoặc event quan trọng.

### Mail failures

```promql
sum(rate(qlt_mail_deliveries_total{result="failed"}[10m])) > 0
```

Tune threshold theo volume.

### Cloudinary webhook stuck

```promql
qlt_cloudinary_webhook_oldest_pending_age_seconds > 300
```

### Redis errors

```promql
sum(rate(qlt_redis_errors_total[5m])) > 0
```

Cần phân severity theo impact; cache fail-open khác queue Redis failure.

## 34. SLO ban đầu

Không đặt SLO tùy ý rồi gọi là production requirement. Bắt đầu đo 2–4 tuần, sau đó chốt.

Baseline đề xuất để thảo luận:

- API availability: 99.9% theo tháng.
- Successful request latency:
  - P95 < 500 ms cho read API phổ biến.
  - P95 < 1 s cho write API phổ biến.
- Outbox delivery:
  - 99% event được enqueue trong 60 giây.
- Mail acceptance:
  - 99% mail job hợp lệ được SMTP accept trong 5 phút.

Tách endpoint nặng như upload/media khỏi SLO chung nếu đặc tính khác.

Dùng burn-rate alerts sau khi có SLO chính thức, không chỉ threshold alert.

---

# PHASE 7 — SECURITY, PRIVACY VÀ COST CONTROL

## 35. Dữ liệu cấm ghi

Không log/trace/metric:

- password/password hash;
- access token/refresh token;
- authorization header;
- cookie/session secret;
- SMTP password;
- Cloudinary API secret;
- database/Redis URL có credential;
- reset password token;
- email verification token;
- raw email body;
- private media signed URL;
- raw request body mặc định;
- full user object;
- raw SQL parameters.

## 36. Dữ liệu cần pseudonymize

- email: hash hoặc chỉ giữ domain;
- IP address: chỉ log khi có lý do security rõ ràng, có retention ngắn;
- user agent: cân nhắc normalize thay vì lưu raw lâu dài;
- userId: có thể log trong restricted backend, nhưng không làm metric label.

## 37. Retention đề xuất

Development/local:

- logs: 3–7 ngày;
- metrics: 7–15 ngày;
- traces: 1–3 ngày.

Production ban đầu:

- logs: 14–30 ngày;
- metrics: 30–90 ngày;
- traces: 3–14 ngày tùy sampling/chi phí;
- audit log: là hệ thống riêng, retention theo yêu cầu nghiệp vụ/pháp lý.

Observability log không thay thế audit log.

## 38. Sampling

Development:

```text
100% traces
```

Production ban đầu:

```text
10% parent-based head sampling
```

Sau đó có thể tail-sample ở collector:

- giữ 100% trace có error;
- giữ 100% trace chậm;
- sample thấp trace thành công nhanh;
- giữ trace của critical business flow.

Không để sampling làm mất toàn bộ trace lỗi.

## 39. Cardinality budget

Mỗi metric mới phải trả lời:

1. Có bao nhiêu giá trị label tối đa?
2. Giá trị có tăng không giới hạn không?
3. Có thể dùng log/trace thay metric không?
4. Có chứa user/entity ID không?

CI/code review phải reject metric có dynamic labels từ request params hoặc database ID.

---

# PHASE 8 — TESTING

## 40. Unit tests

### Logger

- string message.
- object message.
- Error serialization.
- context extraction.
- requestId/correlationId enrichment.
- traceId/spanId enrichment.
- no active context.
- redact nested secret.
- sanitize credential URL.
- circular object không crash.

### Metrics

- registry không đăng ký duplicate metric.
- HTTP request tăng counter đúng.
- duration observe bằng giây, không nhầm millisecond.
- active request luôn decrement khi lỗi.
- metric labels dùng route template.
- metrics endpoint auth đúng.
- metrics endpoint không đi qua response envelope.

### Tracing

- `TracingService.inSpan()` kết thúc span khi success.
- record exception và error status khi throw.
- không nuốt exception.
- disabled SDK không làm app fail.
- invalid sample ratio được clamp.

### Propagation

- enqueue inject `traceparent`.
- worker extract parent context.
- correlationId/outboxEventId được giữ.
- retry vẫn giữ correlation/causation đúng.

## 41. Integration tests

### HTTP

```text
request
→ response có x-request-id/x-correlation-id
→ log có requestId/correlationId/traceId
→ metric counter tăng
→ trace có HTTP span
```

### Database

```text
HTTP/use case span
→ Prisma child span
→ PostgreSQL operation
```

### Outbox/queue

```text
business transaction
→ outbox metadata có trace context
→ dispatcher enqueue
→ worker span có quan hệ parent/link đúng
→ log worker có cùng correlationId
```

### Error

```text
endpoint throw
→ response không lộ stack
→ log có sanitized error
→ span status error
→ metric status 500 tăng
```

## 42. E2E smoke test local stack

Script `scripts/observability/smoke-test.ts` nên:

1. gọi API health;
2. gọi một endpoint thành công;
3. gọi một endpoint lỗi có kiểm soát;
4. tạo một queue job test nếu queue bật;
5. query metrics và assert metric tồn tại;
6. in request ID/trace ID để developer tìm trong Grafana;
7. không phụ thuộc screenshot/manual click để pass CI.

Có thể thêm script:

```json
{
  "observability:up": "docker compose -f ops/observability/docker-compose.observability.yml up -d",
  "observability:down": "docker compose -f ops/observability/docker-compose.observability.yml down",
  "observability:smoke": "tsx scripts/observability/smoke-test.ts"
}
```

---

# PHASE 9 — ROLLOUT

## 43. Thứ tự commit khuyến nghị

### Commit 1 — Config and skeleton

- config type/validation;
- `ObservabilityModule`;
- env example;
- package dependencies.

### Commit 2 — Structured logger

- Pino logger;
- redaction;
- bootstrap wiring;
- unit tests.

### Commit 3 — HTTP logs

- structured `LoggingInterceptor`;
- structured exception logs;
- route template normalization;
- tests.

### Commit 4 — Metrics foundation

- registry/service;
- metrics guard/controller;
- default Node metrics;
- tests.

### Commit 5 — HTTP metrics

- request counter/duration/active;
- exclude health/metrics;
- tests.

### Commit 6 — OpenTelemetry bootstrap

- `instrumentation.ts`;
- entrypoint import ordering;
- graceful shutdown;
- HTTP/Express/Prisma traces.

### Commit 7 — Queue/outbox propagation

- `bullmq-otel`;
- trace carrier in envelope;
- correlation/causation metadata;
- worker logs/traces/metrics.

### Commit 8 — Infrastructure metrics

- outbox;
- mail;
- Redis/cache/lock/idempotency;
- Cloudinary/media.

### Commit 9 — Local stack

- Alloy/Loki/Tempo/Prometheus/Grafana;
- provisioning;
- pinned image versions.

### Commit 10 — Dashboards and alerts

- API dashboard;
- queue/outbox dashboard;
- infra dashboard;
- alert rules;
- runbook links.

### Commit 11 — Smoke tests and documentation

- smoke test;
- operations README;
- troubleshooting;
- Definition of Done.

Không đưa toàn bộ observability vào một commit lớn.

## 44. Feature flags và rollback

Observability failure không được làm business request fail trong các trường hợp bình thường.

- Logger stdout failure: tránh throw.
- Trace exporter unavailable: SDK buffer/retry trong giới hạn, không block request lâu.
- Metrics scrape không ảnh hưởng request bình thường.
- Collector down không làm API down.
- Không chờ remote telemetry network trong hot path.

Có flags:

```env
OBSERVABILITY_ENABLED=false
METRICS_ENABLED=false
OTEL_SDK_DISABLED=true
```

Logger tối thiểu vẫn phải hoạt động khi tracing/metrics tắt.

---

# DEFINITION OF DONE

## 45. Logging

- [ ] Production logs là JSON một dòng.
- [ ] Không còn access log dạng ghép string ở interceptor/filter chính.
- [ ] Mọi HTTP log có request ID và correlation ID.
- [ ] Khi trace active, log có trace ID/span ID.
- [ ] API và worker có service name khác nhau.
- [ ] Secret redaction có test.
- [ ] Không log body/token/password/cookie.
- [ ] Logger flush khi shutdown.

## 46. Metrics

- [ ] Có protected `/internal/metrics`.
- [ ] Có HTTP RED metrics: rate, errors, duration.
- [ ] Có Node.js runtime metrics.
- [ ] Có outbox backlog/age/result metrics.
- [ ] Có BullMQ queue/job metrics.
- [ ] Có mail và Cloudinary webhook metrics.
- [ ] Không có ID động trong metric labels.
- [ ] Prometheus scrape thành công.

## 47. Tracing

- [ ] Instrumentation chạy trước app imports.
- [ ] HTTP server span hoạt động.
- [ ] Prisma spans là child của request/use case.
- [ ] BullMQ producer/consumer trace liên kết đúng.
- [ ] Outbox giữ trace/correlation metadata.
- [ ] Exception được record vào active span.
- [ ] Sampling configurable.
- [ ] SDK shutdown sạch.

## 48. Grafana/operations

- [ ] Grafana có Prometheus, Loki, Tempo datasource.
- [ ] Từ log click được trace ID sang Tempo.
- [ ] Có API dashboard.
- [ ] Có queue/outbox dashboard.
- [ ] Có ít nhất alert API down, 5xx, latency, outbox stuck.
- [ ] Mỗi alert có runbook hoặc mô tả hành động.
- [ ] Local observability stack chạy bằng một command.
- [ ] Smoke test xác nhận logs/metrics/traces.

---

# CÁC LỖI CẦN TRÁNH

1. Dùng raw URL làm metric label.
2. Đưa user/story/chapter/job ID vào metric labels.
3. Log toàn bộ request/response body.
4. Đưa trace setup vào Nest module sau khi Prisma/Express đã import.
5. Tạo span HTTP thủ công trùng với auto instrumentation.
6. Dùng logger gọi Loki trực tiếp từ request thread.
7. Để metrics endpoint public không auth/network restriction.
8. Dùng health endpoint thay cho metrics.
9. Coi observability logs là audit logs.
10. Ghi raw SQL params hoặc credential URL.
11. Tạo logger/registry mới trong từng module.
12. Đăng ký cùng metric name nhiều lần trong test/application context.
13. Không shutdown/flush telemetry.
14. Dùng 100% trace sampling production mà không kiểm tra volume/cost.
15. Alert không có `for` duration gây spam khi transient failure.

---

# PROMPT ĐỀ XUẤT CHO CODEX

```text
Hãy triển khai observability cho backend NestJS này theo file
huong-dan-observability.md.

Yêu cầu bắt buộc:

1. Trước khi sửa, đọc toàn bộ:
   - src/bootstrap
   - src/common/middlewares/request-context.*
   - src/common/interceptors/logging.interceptor.ts
   - src/common/filters/all-exceptions.filter.ts
   - src/common/interfaces/observability
   - src/config
   - src/infrastructure/queue và outbox
   - src/infrastructure/mail
   - src/infrastructure/media/cloudinary
   - src/health
   - package.json và docker-compose.yml

2. Tận dụng RequestContextStore hiện có. Không tạo request context thứ hai.

3. Triển khai theo commit/phases nhỏ:
   - structured logging;
   - metrics;
   - tracing bootstrap;
   - Prisma;
   - BullMQ/outbox propagation;
   - infrastructure metrics;
   - local Grafana stack;
   - dashboards/alerts;
   - tests/docs.

4. OpenTelemetry phải được start trước khi import Nest AppModule,
   WorkerModule, Prisma Client, BullMQ, Express hoặc instrumented libraries.
   Dùng dynamic import entrypoint hoặc Node --import; không chỉ import
   instrumentation sau app module.

5. Production log phải là JSON một dòng và có:
   service.name, service.version, deployment.environment,
   service.instance.id, requestId, correlationId, traceId, spanId khi có.

6. Không log password, token, authorization, cookie, SMTP credential,
   Cloudinary secret, reset token, raw request body, email body hoặc raw SQL
   parameters. Có unit test cho redaction và URL credential sanitization.

7. Metrics phải dùng bounded labels. Cấm requestId, traceId, userId, storyId,
   chapterId, jobId, outboxEventId, raw URL và error message trong labels.

8. Metrics endpoint phải:
   - nằm ở /internal/metrics;
   - không qua response envelope;
   - có bearer token hoặc được bảo vệ rõ bằng network policy;
   - không tự metric/log chính nó.

9. Dùng @prisma/instrumentation cho Prisma traces.

10. Tích hợp BullMQ telemetry bằng bullmq-otel nếu phù hợp với
    @nestjs/bullmq hiện tại. Không tạo duplicate spans. Propagate W3C trace
    context, correlationId và causationId từ transaction/outbox đến worker.

11. Observability backend unavailable không được làm business request fail.
    Không gọi Loki/Tempo trực tiếp trong hot path.

12. Tạo đầy đủ unit/integration tests theo tài liệu. Không bỏ hoặc làm yếu
    test hiện có.

13. Chạy và báo kết quả:
    - npm run build
    - npm run lint
    - npm test -- --runInBand
    - npm run test:e2e -- --runInBand
    - npx prisma validate --config prisma.config.ts

14. Nếu package API khác snippet do version thực tế, ưu tiên type/API của
    package đã cài và ghi rõ điều chỉnh trong tài liệu.

15. Không sửa business behavior ngoài phạm vi cần thiết để gắn telemetry.

Sau khi hoàn thành, báo cáo:
- file đã thêm/sửa;
- metric list và label set;
- log schema;
- span list và propagation flow;
- dashboard/alert list;
- test/build results;
- rủi ro hoặc hạng mục chưa hoàn thành.
```

---

# TÀI LIỆU CHÍNH THỨC THAM KHẢO

- OpenTelemetry JavaScript Node.js getting started: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- OpenTelemetry JavaScript exporters: https://opentelemetry.io/docs/languages/js/exporters/
- OpenTelemetry instrumentation libraries: https://opentelemetry.io/docs/languages/js/libraries/
- Prisma OpenTelemetry tracing: https://docs.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing
- BullMQ telemetry: https://docs.bullmq.io/guide/telemetry/
- BullMQ telemetry getting started: https://docs.bullmq.io/guide/telemetry/getting-started
- BullMQ telemetry metrics: https://docs.bullmq.io/guide/telemetry/metrics
- NestJS logger: https://docs.nestjs.com/techniques/logger
- Prometheus naming: https://prometheus.io/docs/practices/naming/
- Prometheus instrumentation: https://prometheus.io/docs/practices/instrumentation/
- Prometheus histograms: https://prometheus.io/docs/practices/histograms/
- Grafana Loki OTLP ingestion: https://grafana.com/docs/loki/latest/send-data/otel/
- Grafana Tempo collector setup: https://grafana.com/docs/tempo/latest/set-up-for-tracing/instrument-send/set-up-collector/otel-collector/
