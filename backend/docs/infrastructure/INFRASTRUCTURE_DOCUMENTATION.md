# Infrastructure Documentation

> Dự án: **Quản lý truyện — Backend NestJS**  
> Phạm vi: `backend/src/infrastructure`  
> Mục tiêu: giải thích vai trò, cách sử dụng và các quy tắc kiến trúc của tầng hạ tầng.

## Production reliability contract (2026-08)

- API and worker entrypoints load `.env.<NODE_ENV>.local`,
  `.env.<NODE_ENV>`, `.env.local`, then `.env` before dynamically importing
  their Nest module graph. Existing runtime variables are never overridden.
  Production does not read env files; the deployment platform must inject all
  configuration and secrets.

- Outbox delivery is **at-least-once**. Claims use PostgreSQL
  `FOR UPDATE SKIP LOCKED`; `PROCESSING` rows older than
  `OUTBOX_PROCESSING_TIMEOUT_MS` are recovered before the next batch. Every
  claim has a UUID `processingToken`; publish, retry and permanent-failure
  finalization use CAS on `id + PROCESSING + processingToken`, preventing a
  stale worker from finalizing a newer claim. BullMQ job IDs remain
  `outbox-<outboxEventId>`, so consumers must still be idempotent across the
  crash window between enqueue and the `PUBLISHED` database update.
- `OUTBOX_BATCH_SIZE` and `OUTBOX_POLL_INTERVAL_MS` control the repeatable
  dispatcher job. It uses the stable scheduler ID
  `outbox-dispatch-scheduler-v1`; registration failure aborts worker startup
  and instances never remove each other's scheduler. Only `mail` is routed
  because it is the only currently registered business consumer. Unsupported
  aggregate types are non-retryable and become `FAILED`.
- HTTP idempotency storage keys contain the authenticated principal, HTTP
  method, normalized route and a SHA-256 digest of the caller key. Processing
  leases have an owner token. Redis result/failure updates use Lua CAS, so an
  expired request cannot overwrite or delete its successor.
- `IDEMPOTENCY_FAILURE_MODE=closed` is the production default. In-memory
  cache, lock and idempotency adapters are allowed only when
  `ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK=true` outside production. Their
  capacity and sweep lifecycle are bounded by `IN_MEMORY_STORE_MAX_ENTRIES`
  and `IN_MEMORY_STORE_SWEEP_INTERVAL_MS`.
- Both `redis://` and `rediss://` are parsed by one connection-options factory.
  `REDIS_KEY_PREFIX` belongs to app cache/idempotency/locks; `QUEUE_PREFIX`
  belongs to BullMQ and the two must not be combined. `QUEUE_ENABLED=true`
  requires `REDIS_ENABLED=true`; BullMQ uses `REDIS_CONNECT_TIMEOUT_MS` but
  does not apply command timeout to blocking connections.
- `WORKER_CONCURRENCY` is applied to the outbox and mail processors.
  `WORKER_ROLE=all|queue|cloudinary-webhook` limits long-running worker
  responsibilities. Cloudinary inbox polling additionally requires
  `CLOUDINARY_ENABLED=true`. Worker preflight rejects any role with no active
  capability. Cloudinary shutdown awaits the active inbox batch, and inbox
  finalization uses the claimed attempt as its CAS ownership version.
- Redis lock leases are owner-checked on release and heartbeat extension. A
  generic lease cannot undo a side effect after ownership loss; critical
  writers that need stronger guarantees must use fencing tokens checked by
  the destination datastore.
- Mail disabled mode returns `skipped` without rendering or calling SMTP.
  SMTP/outbox delivery is **at-least-once** because a crash can occur after
  SMTP acceptance and before job completion is recorded. Retries for the same
  outbox event use the deterministic Message-ID
  `<outbox-<outboxEventId>@MAIL_MESSAGE_ID_DOMAIN>` to help mail clients group
  duplicates, but SMTP servers are not required to deduplicate it. Templates
  and recipient actions must therefore tolerate repeated delivery.
- `POST /api/v1/auth/register` is the first transactional producer: user,
  email-verification record and `mail.send.v1` outbox row commit or roll back
  together. The HTTP process writes only the outbox row; SMTP and BullMQ are
  never called inside the request transaction. A unique business
  `idempotency_key` prevents duplicate outbox rows during transaction retry.

Operational diagnostics are available at `GET /health/diagnostics` and require
the `audit-log.read` permission. Responses contain only normalized status and
outbox counts; provider URLs, credentials and raw provider errors are omitted.
Public readiness indicators also replace database and Redis exceptions with
fixed messages. Internal connection errors are sanitized before logging.

## Operations quick reference

- Run API and worker as separate processes. Supported worker roles are
  `all`, `queue`, and `cloudinary-webhook`; the queue role requires both Redis
  and queue features, while the Cloudinary role can run independently.
- Inspect `outbox_events` rows in `pending`, `failed`, or stale `processing`
  states and BullMQ failed jobs when investigating backlog/dead letters. Never
  replay a row by clearing ownership fields while an active worker may own it.
- Run maintenance scripts through the dedicated command modules documented in
  `package.json`; they do not bootstrap all worker responsibilities.
- Deploy Prisma migrations with `npm run db:migrate:deploy` before rolling out
  API or worker code, then run `npm run db:verify:constraints` against the
  target environment.

---

## 1. Infrastructure là gì?

`src/infrastructure` chứa các **adapter kỹ thuật dùng chung** để backend giao tiếp với những hệ thống nằm ngoài nghiệp vụ:

- PostgreSQL thông qua Prisma;
- Redis và cache;
- distributed lock và idempotency store;
- object storage như local disk, S3 hoặc GCS;
- queue và background worker;
- transactional outbox và event publisher;
- email, HTTP client và dịch vụ bên thứ ba;
- logging, metrics, tracing;
- health indicator cho các dependency.

Infrastructure trả lời câu hỏi:

> Ứng dụng kết nối và vận hành với database, cache, queue, storage và dịch vụ ngoài như thế nào?

Infrastructure **không trả lời** các câu hỏi nghiệp vụ như:

- Ai được phép xuất bản truyện?
- Chương nào được hiển thị?
- Khi nào truyện chuyển trạng thái?
- Người dùng có quyền sửa bình luận hay không?

Các quy tắc đó thuộc module nghiệp vụ.

---

## 2. Hiện trạng của dự án

Trong mã nguồn hiện tại chưa có `src/infrastructure` hoàn chỉnh. Tuy nhiên dự án đã chuẩn bị nhiều thành phần liên quan:

- Prisma schema và PostgreSQL trong `prisma/`;
- `@prisma/client`, `@prisma/adapter-pg` và `pg` trong `package.json`;
- các exception `DatabaseException`, `CacheException`, `QueueException`, `StorageException`;
- các injection token như `CACHE_STORE`, `DISTRIBUTED_LOCK`, `EVENT_PUBLISHER`, `IDEMPOTENCY_STORE`;
- các interface event, outbox và file trong `src/common/interfaces`;
- bảng `outbox_events`, `media_assets`, `notifications`, `story_daily_stats` trong Prisma schema;
- folder `src/health` đã được tạo nhưng chưa triển khai;
- constants cho cache, queue và upload đã tồn tại.

Như vậy dự án đã có **contract và database model**, nhưng chưa có adapter thực tế để sử dụng chúng.

---

## 3. Nguyên tắc phụ thuộc

Luồng phụ thuộc nên theo hướng:

```text
Controller
   ↓
Application service / use case
   ↓
Port / repository interface
   ↑
Infrastructure adapter
   ↓
PostgreSQL / Redis / S3 / Queue / SMTP / HTTP service
```

Quy tắc bắt buộc:

1. Domain và application không phụ thuộc concrete adapter.
2. Infrastructure được phép phụ thuộc config, common contract và generated Prisma Client.
3. `common` không được import ngược từ `infrastructure`.
4. Controller không nên thao tác trực tiếp với Redis, queue hoặc S3.
5. Business service không được tự tạo `PrismaClient`, Redis client hoặc SDK client.
6. Mỗi external client chỉ có một provider quản lý lifecycle.
7. Repository riêng của một module nên nằm trong module sở hữu nghiệp vụ, không đổ toàn bộ vào `src/infrastructure`.

Ví dụ repository của truyện:

```text
src/modules/stories/
├── application/
│   └── ports/
│       └── story.repository.ts
└── infrastructure/
    └── persistence/
        └── prisma-story.repository.ts
```

Trong khi Prisma client dùng chung nằm tại:

```text
src/infrastructure/database/prisma/
```

---

## 4. Cấu trúc folder đề xuất

```text
src/infrastructure/
├── database/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   ├── prisma-error.mapper.ts
│   │   └── index.ts
│   └── index.ts
│
├── cache/
│   ├── redis/
│   │   ├── redis.module.ts
│   │   ├── redis.client.ts
│   │   ├── redis-cache.adapter.ts
│   │   └── redis-health.indicator.ts
│   └── index.ts
│
├── locking/
│   ├── redis-distributed-lock.adapter.ts
│   └── index.ts
│
├── idempotency/
│   ├── redis-idempotency-store.adapter.ts
│   └── index.ts
│
├── storage/
│   ├── local/
│   │   └── local-storage.adapter.ts
│   ├── s3/
│   │   └── s3-storage.adapter.ts
│   ├── storage.module.ts
│   └── index.ts
│
├── queue/
│   ├── queue.module.ts
│   ├── queue-names.constants.ts
│   ├── queue-producer.service.ts
│   └── index.ts
│
├── events/
│   ├── outbox/
│   │   ├── outbox.repository.ts
│   │   ├── outbox-dispatcher.service.ts
│   │   └── outbox.processor.ts
│   ├── event-publisher.adapter.ts
│   └── index.ts
│
├── mail/
│   ├── mail.module.ts
│   ├── mailer.adapter.ts
│   └── index.ts
│
├── http/
│   ├── external-http.module.ts
│   ├── external-http.client.ts
│   └── index.ts
│
├── observability/
│   ├── logging/
│   ├── metrics/
│   ├── tracing/
│   └── index.ts
│
├── health/
│   ├── database-health.indicator.ts
│   ├── redis-health.indicator.ts
│   └── index.ts
│
├── infrastructure.module.ts
└── index.ts
```

Không cần tạo tất cả ngay. Nên triển khai theo thứ tự ưu tiên ở phần 16.

---

## 5. `InfrastructureModule` có nhiệm vụ gì?

`InfrastructureModule` là composition module tập hợp những adapter dùng chung đã được triển khai.

Ví dụ:

```ts
@Module({
  imports: [PrismaModule, StorageModule, RedisModule, QueueModule],
  exports: [PrismaModule, StorageModule, RedisModule, QueueModule],
})
export class InfrastructureModule {}
```

Quy tắc sử dụng:

- `AppModule` có thể import `InfrastructureModule` một lần.
- Module nghiệp vụ nên import module hạ tầng nhỏ nhất mà nó thực sự cần.
- Không biến `InfrastructureModule` thành một module khổng lồ bắt buộc mọi feature phải import.
- Không đánh dấu toàn bộ infrastructure là `@Global()` chỉ để giảm vài dòng import.

---

## 6. Database và Prisma

### 6.1 Trách nhiệm

`PrismaModule` quản lý:

- một instance duy nhất của `PrismaClient`;
- PostgreSQL driver adapter;
- connect/disconnect lifecycle;
- query logging phù hợp môi trường;
- mapping lỗi kỹ thuật;
- transaction helper dùng chung nếu thực sự cần.

Prisma ORM 7 yêu cầu driver adapter cho kết nối trực tiếp. Dự án đã có `@prisma/adapter-pg`, vì vậy Prisma Client phải được tạo với `PrismaPg`.

### 6.2 Cách sử dụng đúng

Repository adapter có thể inject `PrismaService`:

```ts
@Injectable()
export class PrismaStoryRepository implements StoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<StoryRecord | null> {
    return this.prisma.story.findUnique({
      where: { id },
    });
  }
}
```

Application service chỉ inject repository port:

```ts
@Injectable()
export class GetStoryUseCase {
  constructor(
    @Inject(STORY_REPOSITORY)
    private readonly stories: StoryRepository,
  ) {}
}
```

### 6.3 Không nên làm

```ts
@Injectable()
export class StoryService {
  private readonly prisma = new PrismaClient();
}
```

Mỗi `PrismaClient` có thể tạo thêm connection pool. Việc tạo client rải rác dễ làm cạn kết nối database.

### 6.4 Transaction

Transaction phải bao trọn một use case cần tính nguyên tử, ví dụ:

- duyệt submission;
- đổi trạng thái truyện;
- ghi moderation action;
- tạo notification/outbox event.

Không mở transaction trong controller.

Không giữ transaction trong lúc:

- gọi email provider;
- upload S3;
- gọi HTTP service;
- xử lý ảnh lâu;
- chờ queue response.

External side effect nên đi qua outbox hoặc thực hiện sau khi database transaction hoàn tất.

---

## 7. Cache và Redis

Redis trong dự án nên phục vụ các nhu cầu:

- cache dữ liệu đọc nhiều;
- distributed lock;
- idempotency store;
- rate limit state;
- queue backend nếu dùng BullMQ;
- session/revocation data nếu thiết kế auth yêu cầu.

### 7.1 Cache-aside

Luồng đọc chuẩn:

```text
1. Tạo cache key
2. Đọc Redis
3. Cache hit → trả dữ liệu
4. Cache miss → đọc database
5. Ghi cache với TTL
6. Trả dữ liệu
```

Ví dụ key:

```text
v1:story:public:7cb8...
v1:story:slug:dao-kiem-than-vuc
v1:ranking:daily:2026-07-31
```

Dùng `CACHE_SCHEMA_VERSION` và `joinCacheKey()` đã có trong `common/constants`.

### 7.2 Quy tắc cache

- PostgreSQL vẫn là source of truth.
- Cache failure không được làm hỏng request đọc thông thường nếu có thể fallback database.
- Không cache password hash, token, secret hoặc dữ liệu nhạy cảm.
- Dữ liệu theo user phải có `userId` trong key.
- Mọi cache entry phải có TTL trừ trường hợp được thiết kế rõ ràng.
- Mutation phải invalidate hoặc refresh cache liên quan.
- Không dùng wildcard scan trên production request path.

---

## 8. Distributed lock

Distributed lock dùng khi nhiều instance có thể chạy cùng một tác vụ:

- publish chapter được lên lịch;
- dispatch outbox;
- tổng hợp thống kê ngày;
- reconcile counter;
- tạo image variants;
- xử lý một job có nguy cơ chạy trùng.

Lock không thay thế database constraint.

Ví dụ:

```text
lock:chapter:publish:{chapterId}
lock:outbox:dispatcher
lock:stats:story:{storyId}:{date}
```

Lock phải có:

- TTL;
- owner token duy nhất;
- release chỉ khi owner token khớp;
- giới hạn thời gian chờ;
- xử lý trường hợp task lâu hơn TTL.

---

## 9. Idempotency

Idempotency phù hợp cho request có side effect có thể bị gửi lại:

- thanh toán trong tương lai;
- submit truyện;
- publish chapter;
- upload hoàn tất;
- webhook bên thứ ba;
- admin moderation action quan trọng.

Một idempotency record tối thiểu nên lưu:

```text
key
actor/user
route hoặc operation
request hash
status: processing | completed | failed
response status
response body
expiresAt
```

Nếu cùng key nhưng request hash khác nhau, trả `IdempotencyConflictException`.

Không dùng idempotency key như authorization token.

---

## 10. Object storage và media

Schema đã có `MediaAsset`, `MediaStatus` và `MediaPurpose`, nên storage là hạ tầng quan trọng của dự án.

### 10.1 Provider đề xuất

- Development: local filesystem.
- Test: in-memory hoặc temporary directory.
- Production: S3-compatible storage.

Local storage không phù hợp production nếu container dùng ephemeral filesystem hoặc chạy nhiều replica.

### 10.2 Luồng upload an toàn

```text
1. Xác thực user và quyền upload
2. Kiểm tra dung lượng
3. Kiểm tra MIME thực tế, không chỉ extension
4. Tạo MediaAsset trạng thái PENDING
5. Upload object
6. Tạo checksum/metadata
7. Cập nhật MediaAsset thành READY
8. Enqueue xử lý ảnh nếu cần
9. Nếu lỗi: đánh dấu FAILED và dọn object đã upload
```

Storage key nên do server tạo:

```text
media/{purpose}/{yyyy}/{mm}/{uuid}.{extension}
```

Không dùng trực tiếp original filename làm storage key.

---

## 11. Queue và background worker

Các tác vụ phù hợp đưa vào queue:

- resize ảnh và tạo thumbnail;
- gửi email xác minh/reset password;
- fan-out notification;
- publish chương theo lịch;
- xử lý outbox;
- tổng hợp thống kê;
- indexing tìm kiếm;
- dọn token/session/media hết hạn.

Không đưa vào queue những thao tác mà HTTP request phải biết kết quả ngay để đảm bảo tính đúng đắn.

### 11.1 Job payload

Payload nên nhỏ và có version:

```ts
interface GenerateStoryCoverVariantsJobV1 {
  version: 1;
  mediaAssetId: string;
  requestedAt: string;
  correlationId?: string;
}
```

Không nhét toàn bộ entity hoặc file buffer lớn vào Redis queue.

### 11.2 Retry

Retry chỉ phù hợp với lỗi tạm thời:

- timeout;
- mất kết nối;
- upstream 5xx;
- rate limit có retry-after.

Không retry vô hạn với:

- validation error;
- resource không tồn tại;
- payload sai schema;
- permission error.

Sau số lần retry tối đa, job phải được giữ lại để quan sát hoặc chuyển dead-letter flow.

---

## 12. Transactional outbox

Dự án đã có bảng `outbox_events`. Outbox dùng để tránh tình huống:

```text
Database đã commit nhưng publish event thất bại
```

Luồng chuẩn:

```text
1. Business transaction cập nhật dữ liệu
2. Cùng transaction tạo outbox row PENDING
3. Dispatcher đọc các row khả dụng
4. Publish event vào queue/event bus
5. Đánh dấu PUBLISHED
6. Nếu lỗi, tăng attempts và đặt availableAt cho lần retry
```

Outbox cung cấp semantics **at-least-once**, vì vậy consumer phải idempotent.

Trong môi trường nhiều worker, dispatcher phải claim row an toàn bằng locking hoặc atomic status transition. Không để hai worker cùng publish một row mà không có cơ chế chống trùng.

---

## 13. Email và external HTTP

### 13.1 Email

Mailer adapter nên nhận dữ liệu nghiệp vụ đã chuẩn hóa:

```ts
await mailer.sendEmailVerification({
  recipient,
  verificationUrl,
  locale,
});
```

Application service không nên biết SMTP host, API key hoặc template provider.

Email nên gửi qua queue để request không bị block và có retry.

### 13.2 HTTP client

Mọi external HTTP client cần:

- timeout bắt buộc;
- retry có giới hạn;
- correlation/request ID;
- redact authorization header;
- mapping upstream error thành `ExternalServiceException`;
- circuit breaker khi dịch vụ thực sự cần;
- metric latency và error rate.

Không dùng `fetch()` hoặc axios rải rác trong business service.

---

## 14. Observability

Infrastructure observability bao gồm:

- structured logging;
- metrics;
- distributed tracing;
- health/readiness indicators.

Log nên mang context đã có trong dự án:

```text
requestId
correlationId
traceId
userId
sessionId
module
action
durationMs
```

Không log:

- password;
- JWT;
- refresh token;
- reset token;
- cookie;
- API key;
- raw file buffer.

Tận dụng `redact.util.ts` và sensitive field constants hiện có.

---

## 15. Health check

Nên có hai endpoint khác nhau:

### Liveness

```text
GET /api/v1/health/live
```

Chỉ xác nhận process còn hoạt động. Không kiểm tra database hoặc Redis.

### Readiness

```text
GET /api/v1/health/ready
```

Kiểm tra những dependency cần thiết để nhận traffic:

- PostgreSQL;
- Redis nếu request path phụ thuộc Redis;
- queue connection nếu queue là dependency bắt buộc;
- storage chỉ khi upload/read asset đi qua backend.

Không gọi dịch vụ ngoài chậm ở mọi health request nếu nó không quyết định readiness.

Health endpoint nên bỏ qua:

- maintenance block;
- authentication;
- response envelope tùy format của platform;
- request logging quá chi tiết.

---

## 16. Thứ tự triển khai cho dự án này

### P0 — bắt buộc

1. `PrismaModule` và `PrismaService`.
2. Prisma error mapping cơ bản.
3. Database readiness check.
4. Import `HealthModule` vào `AppModule`.
5. Bật shutdown hooks trong bootstrap.

### P1 — cần cho media và vận hành

1. Local storage adapter cho development.
2. S3-compatible adapter cho production.
3. Media upload lifecycle.
4. Structured logger và redaction.
5. Liveness/readiness endpoints hoàn chỉnh.

### P2 — khi có workload nền

1. Redis client.
2. Cache store adapter.
3. Distributed lock.
4. Idempotency store.
5. BullMQ queue.
6. Worker entry point.
7. Transactional outbox dispatcher.

### P3 — scale và tích hợp

1. Email provider.
2. External HTTP client chuẩn hóa.
3. Metrics và tracing.
4. Dead-letter/replay tooling.
5. Read replica hoặc connection proxy khi có nhu cầu thực tế.

---

## 17. Quy tắc exception

Infrastructure adapter nên map lỗi kỹ thuật sang các exception đã có:

| Thành phần          | Exception                  |
| ------------------- | -------------------------- |
| PostgreSQL/Prisma   | `DatabaseException`        |
| Redis cache         | `CacheException`           |
| Queue               | `QueueException`           |
| S3/local storage    | `StorageException`         |
| SMTP/API bên thứ ba | `ExternalServiceException` |
| Sai cấu hình        | `ConfigurationException`   |

Không đưa connection string, bucket secret, SQL raw hoặc stack trace vào response public.

Feature repository được phép map lỗi cụ thể thành business exception, ví dụ unique slug thành `ResourceConflictException`.

---

## 18. Testing

Mỗi adapter cần ít nhất ba lớp test:

### Unit test

- mock external client;
- kiểm tra mapping input/output;
- kiểm tra error mapping;
- kiểm tra retry/invalidation policy.

### Integration test

- chạy PostgreSQL/Redis thật trong Docker;
- xác nhận transaction rollback;
- xác nhận cache TTL;
- xác nhận lock ownership;
- xác nhận storage upload/delete;
- xác nhận queue retry.

### End-to-end test

- request đi qua controller/use case/repository;
- database thay đổi đúng;
- outbox được ghi cùng transaction;
- worker xử lý event/job đúng;
- failure không làm mất dữ liệu.

Không dùng mock Prisma cho mọi test repository. Repository query cần được kiểm tra với PostgreSQL thật.

---

## 19. Anti-patterns cần tránh

- Tạo `new PrismaClient()` trong nhiều service.
- Import Redis/S3 SDK trực tiếp vào controller.
- Đặt business rule trong Prisma repository.
- Dùng Redis làm source of truth cho truyện/chương.
- Gửi email trước khi database transaction commit.
- Upload file trong transaction database dài.
- Queue payload chứa password, token hoặc file buffer lớn.
- Retry mọi lỗi mà không phân loại.
- Dùng local filesystem trên production nhiều replica.
- Swallow infrastructure error rồi trả dữ liệu giả.
- Dùng `KEYS *` hoặc scan lớn trên request path.
- Tạo generic repository bao phủ mọi model Prisma.
- Đặt tất cả feature repositories trong một folder `infrastructure/repositories` khổng lồ.

---

## 20. Checklist sử dụng infrastructure

Trước khi dùng một adapter mới, kiểm tra:

- [ ] Port/interface thuộc application hoặc module sở hữu nghiệp vụ.
- [ ] Concrete adapter chỉ nằm trong infrastructure.
- [ ] Provider được bind bằng class/token duy nhất.
- [ ] External client có lifecycle shutdown.
- [ ] Config được validate khi startup.
- [ ] Timeout đã được cấu hình.
- [ ] Retry chỉ áp dụng cho lỗi tạm thời.
- [ ] Secret không xuất hiện trong log.
- [ ] Health indicator đã được xác định nếu dependency là bắt buộc.
- [ ] Unit và integration test đã có.
- [ ] Không tạo circular dependency.
- [ ] Không làm business layer phụ thuộc SDK cụ thể.

---

## 21. Tài liệu tham khảo chính thức

- Prisma Client setup và driver adapters: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction
- Prisma database connections: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- NestJS health checks: https://docs.nestjs.com/recipes/terminus
- NestJS queues: https://docs.nestjs.com/techniques/queues
- NestJS dynamic modules: https://docs.nestjs.com/fundamentals/dynamic-modules

---

## 22. Definition of Done

Tầng infrastructure được coi là đạt yêu cầu cơ bản khi:

- backend chỉ có một Prisma client được DI quản lý;
- application khởi động thất bại rõ ràng khi config bắt buộc sai;
- database connection được đóng khi shutdown;
- `/health/live` và `/health/ready` hoạt động;
- feature module dùng repository/port thay vì SDK trực tiếp;
- storage, Redis và queue được bật theo config, không hardcode;
- exception kỹ thuật được normalize;
- secret được redact;
- các adapter quan trọng có integration test;
- outbox và worker có idempotency trước khi chạy nhiều replica.
