# Infrastructure Implementation Guide

> Dự án: **Quản lý truyện — Backend NestJS**  
> Mục tiêu: triển khai `backend/src/infrastructure` theo từng giai đoạn an toàn và có thể kiểm thử.

---

## 1. Kết quả cuối cùng mong muốn

Sau khi hoàn thành các giai đoạn chính, backend có cấu trúc:

```text
src/
├── bootstrap/
├── config/
├── infrastructure/
│   ├── database/
│   ├── cache/
│   ├── locking/
│   ├── idempotency/
│   ├── storage/
│   ├── queue/
│   ├── events/
│   ├── mail/
│   ├── http/
│   ├── observability/
│   ├── health/
│   ├── infrastructure.module.ts
│   └── index.ts
├── modules/
└── health/
```

Không triển khai tất cả trong một commit. Làm theo từng phase và giữ backend chạy được sau mỗi phase.

---

## 2. Kiểm tra trước khi triển khai

### 2.1 Prisma 7 và module system

Dự án hiện dùng:

```json
"@prisma/client": "^7.9.1",
"@prisma/adapter-pg": "^7.9.1",
"prisma": "^7.9.1"
```

nhưng `tsconfig.json` đang dùng:

```json
"module": "commonjs"
```

Tài liệu Prisma 7 định hướng ESM và yêu cầu driver adapter cho direct database connection. Trước khi viết nhiều infrastructure code, cần chạy:

```bash
npm install
npm run build
npm test
```

Nếu generated Prisma Client không tương thích build CommonJS hiện tại, chốt một trong hai hướng:

1. Chuyển backend sang ESM/NodeNext theo hướng dẫn Prisma 7; hoặc
2. Pin Prisma về phiên bản đã được dự án kiểm chứng.

Không trộn migration module system với toàn bộ Redis/queue/storage trong cùng một commit.

### 2.2 Config prerequisite

Infrastructure nên đọc cấu hình qua `ConfigService`, không dùng `process.env` rải rác. Hoàn thành `src/config` theo `CONFIG_IMPLEMENTATION_GUIDE.md` trước hoặc cùng phase database.

Cài dependency tối thiểu:

```bash
npm install @nestjs/config @nestjs/terminus
```

---

# PHASE 1 — DATABASE VÀ HEALTH

## 3. Tạo Prisma infrastructure

Tạo folder:

```text
src/infrastructure/database/prisma/
├── prisma.module.ts
├── prisma.service.ts
├── prisma-error.mapper.ts
└── index.ts
```

### 3.1 `prisma.service.ts`

```ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString =
      configService.getOrThrow<string>('database.url');

    const adapter = new PrismaPg({
      connectionString,
    });

    const environment =
      configService.get<string>('app.environment') ?? 'development';

    super({
      adapter,
      log:
        environment === 'development'
          ? ['warn', 'error']
          : ['error'],
      transactionOptions: {
        maxWait: 5_000,
        timeout: 10_000,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PostgreSQL connection closed');
  }
}
```

Lưu ý:

- Import path generated client phải khớp output thực tế sau `prisma generate`.
- Không log `DATABASE_URL`.
- Chỉ tạo một `PrismaService` provider.
- `transactionOptions` cần được điều chỉnh theo workload thật, không tăng vô hạn.

### 3.2 `prisma.module.ts`

```ts
import { Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Không cần `@Global()` ở giai đoạn đầu. Import rõ ràng giúp thấy dependency của module.

### 3.3 Barrel exports

```ts
// src/infrastructure/database/prisma/index.ts
export * from './prisma.module';
export * from './prisma.service';
```

```ts
// src/infrastructure/database/index.ts
export * from './prisma';
```

---

## 4. Prisma error mapper

Tạo `prisma-error.mapper.ts`:

```ts
import { Prisma } from '@/generated/prisma/client';
import {
  ConcurrencyConflictException,
  DatabaseException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export function mapPrismaError(
  error: unknown,
  context: {
    operation: string;
    resource?: string;
  },
): Error {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return new DatabaseException({
      operation: context.operation,
      cause: error,
    });
  }

  switch (error.code) {
    case 'P2002':
      return new ResourceConflictException({
        message: `${context.resource ?? 'Tài nguyên'} đã tồn tại`,
        cause: error,
      });

    case 'P2025':
      return new ResourceNotFoundException({
        resource: context.resource ?? 'resource',
        cause: error,
      });

    case 'P2034':
      return new ConcurrencyConflictException({
        cause: error,
      });

    default:
      return new DatabaseException({
        operation: context.operation,
        details: {
          prismaCode: error.code,
        },
        cause: error,
      });
  }
}
```

Constructor của exception trong dự án có thể khác code mẫu. Điều chỉnh theo chữ ký thực tế trước khi commit.

Không map mọi `P2002` thành cùng một message tại tầng dùng chung nếu feature cần biết field cụ thể. Repository của feature có thể map chi tiết hơn:

```ts
try {
  return await this.prisma.story.create({ data });
} catch (error: unknown) {
  throw mapStoryPersistenceError(error);
}
```

---

## 5. Tạo repository adapter theo module

Không tạo `GenericPrismaRepository<T>`.

Ví dụ:

```text
src/modules/stories/
├── application/
│   └── ports/
│       └── story.repository.ts
├── infrastructure/
│   └── persistence/
│       ├── prisma-story.repository.ts
│       └── story-persistence.mapper.ts
└── stories.module.ts
```

Port:

```ts
export const STORY_REPOSITORY = Symbol('STORY_REPOSITORY');

export interface StoryRepository {
  findById(id: string): Promise<Story | null>;
  save(story: Story): Promise<void>;
}
```

Adapter:

```ts
@Injectable()
export class PrismaStoryRepository implements StoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Story | null> {
    const row = await this.prisma.story.findUnique({
      where: { id },
    });

    return row ? StoryPersistenceMapper.toDomain(row) : null;
  }

  async save(story: Story): Promise<void> {
    const data = StoryPersistenceMapper.toPersistence(story);

    await this.prisma.story.upsert({
      where: { id: story.id },
      create: data,
      update: data,
    });
  }
}
```

Provider binding trong `StoriesModule`:

```ts
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: STORY_REPOSITORY,
      useClass: PrismaStoryRepository,
    },
  ],
  exports: [STORY_REPOSITORY],
})
export class StoriesModule {}
```

---

## 6. Transaction và outbox cùng database transaction

Một use case publish chapter có thể cần:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.chapter.update({
    where: { id: chapterId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  await tx.outboxEvent.create({
    data: {
      aggregateType: 'chapter',
      aggregateId: chapterId,
      eventType: 'chapter.published.v1',
      payload: {
        chapterId,
        storyId,
      },
    },
  });
});
```

Không publish queue bên trong transaction. Chỉ ghi outbox row.

Khi use case cần transaction qua nhiều repository, tạo `UnitOfWork` hoặc transaction context rõ ràng. Không truyền `PrismaService` xuống domain entity.

---

## 7. Health module

Folder `src/health` hiện đang rỗng. Cài Terminus và triển khai hai endpoint.

### 7.1 `database-health.indicator.ts`

```ts
import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';

import { PrismaService } from '@/infrastructure/database';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(
    key = 'database',
  ): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check(key);

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error: unknown) {
      return indicator.down({
        message:
          error instanceof Error
            ? error.message
            : 'Database unavailable',
      });
    }
  }
}
```

Không trả database host, username hoặc connection string trong health response.

### 7.2 `health.controller.ts`

```ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
} from '@nestjs/terminus';

import {
  Public,
  SkipResponseEnvelope,
} from '@/common/decorators';
import { DatabaseHealthIndicator } from '@/infrastructure/health';

@Controller('health')
@Public()
@SkipResponseEnvelope()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.database.isHealthy(),
    ]);
  }
}
```

### 7.3 `health.module.ts`

```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { PrismaModule } from '@/infrastructure/database';
import { DatabaseHealthIndicator } from '@/infrastructure/health';

import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator],
})
export class HealthModule {}
```

Import `HealthModule` vào `AppModule`.

Cập nhật maintenance allowed paths:

```ts
allowedPaths: [
  '/api/v1/health/live',
  '/api/v1/health/ready',
],
```

Bật shutdown hooks trong bootstrap:

```ts
app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
```

---

## 8. Test database infrastructure

### Unit test

- error mapper cho P2002, P2025, P2034;
- repository mapper;
- provider wiring.

### Integration test

Dùng PostgreSQL thật từ Docker Compose:

```bash
docker compose up -d postgres
npm run db:migrate:deploy
npm run test:e2e
```

Kiểm tra:

- connect thành công;
- transaction rollback khi callback throw;
- unique constraints hoạt động;
- manual constraints đã nằm trong migration;
- shutdown đóng connection;
- readiness trả lỗi khi database dừng.

---

# PHASE 2 — STORAGE VÀ MEDIA

## 9. Tạo storage port

Port nên do module media sở hữu:

```text
src/modules/media/application/ports/object-storage.port.ts
```

```ts
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  checksum?: string;
}

export interface ObjectStoragePort {
  put(input: PutObjectInput): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPublicUrl?(key: string): string;
  createSignedReadUrl?(key: string, ttlSeconds: number): Promise<string>;
}
```

Nếu nhiều module cùng dùng storage, chuyển port sang `src/common/interfaces/ports` hoặc một `src/core/ports` độc lập. Không đặt port bên trong concrete S3 folder.

---

## 10. Local storage adapter

```text
src/infrastructure/storage/local/
├── local-storage.adapter.ts
└── index.ts
```

Yêu cầu:

- resolve path bên trong storage root;
- chống path traversal;
- tạo folder bằng `mkdir({ recursive: true })`;
- ghi file atomic khi có thể;
- không dùng original filename làm key;
- xóa idempotent: file không tồn tại vẫn coi là thành công.

Local adapter chỉ bật trong development/test.

Environment:

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=./var/storage
PUBLIC_ASSET_BASE_URL=http://localhost:3000/api/v1/media
```

Thêm `var/storage/` vào `.gitignore`.

---

## 11. S3 adapter

Cài khi bắt đầu production storage:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Environment:

```env
STORAGE_PROVIDER=s3
S3_REGION=ap-southeast-1
S3_BUCKET=quan-ly-truyen-media
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

Không commit access key.

`StorageModule` dùng `registerAsync()` hoặc provider factory để chọn adapter:

```ts
{
  provide: OBJECT_STORAGE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const provider =
      config.getOrThrow<string>('storage.provider');

    if (provider === 'local') {
      return new LocalStorageAdapter(/* config */);
    }

    if (provider === 's3') {
      return new S3StorageAdapter(/* config */);
    }

    throw new ConfigurationException({
      key: 'STORAGE_PROVIDER',
    });
  },
}
```

Ưu tiên dùng class providers với injected options thay vì `new` phức tạp trong factory khi adapter có nhiều dependency.

---

## 12. Media workflow

Triển khai theo trạng thái trong schema:

```text
PENDING → READY
PENDING → FAILED
READY   → DELETED
```

Luồng service:

1. Validate size theo `DEFAULT_MAX_UPLOAD_SIZE_BYTES`.
2. Validate MIME và magic bytes.
3. Generate UUID storage key.
4. Tạo `media_assets` trạng thái `PENDING`.
5. Upload object.
6. Cập nhật checksum, size, mime, `READY`.
7. Enqueue image processing nếu là ảnh.
8. Nếu lỗi, đánh dấu `FAILED` và best-effort delete object.

Thêm scheduled cleanup cho `PENDING`/`FAILED` quá hạn.

---

# PHASE 3 — REDIS, CACHE, LOCK VÀ IDEMPOTENCY

## 13. Cài Redis client

```bash
npm install ioredis
```

Environment:

```env
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=qlt
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_COMMAND_TIMEOUT_MS=3000
CACHE_DEFAULT_TTL_SECONDS=300
```

Không bắt buộc Redis khi subsystem chưa được bật. Config cần hỗ trợ:

```env
REDIS_ENABLED=false
```

---

## 14. Redis module

Tạo một client provider duy nhất và đóng kết nối khi shutdown.

```text
src/infrastructure/cache/redis/
├── redis.constants.ts
├── redis.client.provider.ts
├── redis.module.ts
├── redis-cache.adapter.ts
└── redis-health.indicator.ts
```

Provider token riêng:

```ts
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
```

Không inject trực tiếp `Redis` client vào business service. Chỉ adapter kỹ thuật được dùng raw client.

---

## 15. Cache port và adapter

Port dùng chung:

```ts
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<void>;
}
```

Bind với token đã có:

```ts
{
  provide: CACHE_STORE,
  useClass: RedisCacheAdapter,
}
```

Serialization phải có version và xử lý `BigInt`, `Date`, `Decimal` rõ ràng. Không `JSON.stringify` Prisma object một cách mù quáng.

Cache failure policy:

- `get`: log warning, fallback database khi an toàn;
- `set/delete`: log warning và metric;
- operation bắt buộc tính đúng đắn không dựa vào cache.

---

## 16. Distributed lock

Triển khai atomic acquire bằng Redis:

```text
SET key ownerToken NX PX ttlMs
```

Release bằng Lua script so sánh owner token trước khi delete.

Interface:

```ts
export interface DistributedLock {
  withLock<T>(
    key: string,
    options: {
      ttlMs: number;
      waitMs?: number;
    },
    work: () => Promise<T>,
  ): Promise<T>;
}
```

Bind với `DISTRIBUTED_LOCK` đã có.

Integration test bắt buộc chứng minh:

- hai caller không cùng giữ lock;
- caller khác không release được lock;
- lock hết hạn;
- exception trong work vẫn release lock.

---

## 17. Idempotency store

Bind với `IDEMPOTENCY_STORE` đã có.

Record nên có TTL và state transition atomic:

```text
MISSING → PROCESSING → COMPLETED
                    ↘ FAILED
```

Dùng Lua hoặc transaction Redis để tránh hai request cùng claim một key.

Không trả lại response cache nếu request hash không khớp.

Sau khi store ổn định mới triển khai `IdempotencyInterceptor` để đọc metadata từ `@Idempotent()` hiện có.

---

# PHASE 4 — QUEUE, WORKER VÀ OUTBOX

## 18. Cài BullMQ

```bash
npm install @nestjs/bullmq bullmq
```

BullMQ dùng Redis, nhưng queue connection nên có config riêng nếu production cần tách cluster.

Environment:

```env
QUEUE_ENABLED=true
QUEUE_PREFIX=qlt
QUEUE_DEFAULT_ATTEMPTS=3
QUEUE_DEFAULT_BACKOFF_MS=5000
WORKER_CONCURRENCY=5
```

Queue names:

```ts
export const QUEUE_NAMES = {
  MEDIA: 'media',
  MAIL: 'mail',
  NOTIFICATIONS: 'notifications',
  STORY_SCHEDULING: 'story-scheduling',
  ANALYTICS: 'analytics',
  OUTBOX: 'outbox',
} as const;
```

---

## 19. Tách API process và worker process

Development có thể chạy worker cùng app. Production nên có entry point riêng:

```text
src/main.ts
src/worker.ts
src/bootstrap/application.bootstrap.ts
src/bootstrap/worker.bootstrap.ts
```

`worker.ts` tạo application context, không mở HTTP server:

```ts
const context = await NestFactory.createApplicationContext(
  WorkerModule,
  { bufferLogs: true },
);

context.enableShutdownHooks();
```

`package.json`:

```json
{
  "scripts": {
    "start:worker:dev": "nest start --entryFile worker --watch",
    "start:worker:prod": "node dist/worker"
  }
}
```

Kiểm tra output thực tế của Nest webpack trước khi dùng production command.

---

## 20. Job contracts

Đặt contract trong module sở hữu use case hoặc một package contract rõ ràng:

```ts
export const GENERATE_COVER_VARIANTS_JOB =
  'media.generate-cover-variants.v1';

export interface GenerateCoverVariantsJobV1 {
  version: 1;
  mediaAssetId: string;
  correlationId?: string;
}
```

Processor phải validate version trước khi xử lý.

Job nên truyền ID, không truyền toàn bộ record Prisma.

---

## 21. Outbox dispatcher

### 21.1 Luồng

1. Query batch `PENDING` có `availableAt <= now`.
2. Claim row atomically.
3. Publish event/job.
4. Mark `PUBLISHED` và `processedAt`.
5. Nếu lỗi, tăng `attempts`, lưu error đã sanitize và tính `availableAt` tiếp theo.
6. Sau ngưỡng retry, đánh dấu `FAILED`.

### 21.2 Multi-worker safety

Khi chạy nhiều worker, dùng một trong các chiến lược:

- PostgreSQL `FOR UPDATE SKIP LOCKED` trong transaction;
- atomic `UPDATE ... WHERE status = 'PENDING' RETURNING ...`;
- distributed lock cộng với optimistic status update.

Không chỉ `findMany()` rồi lần lượt update vì hai worker có thể đọc cùng rows.

### 21.3 At-least-once

Event có thể được publish lại nếu worker crash sau publish nhưng trước mark `PUBLISHED`. Consumer phải lưu processed event/job ID hoặc dùng operation idempotent.

---

# PHASE 5 — MAIL VÀ EXTERNAL HTTP

## 22. Mail adapter

Chọn một provider sau khi xác định deployment:

- SMTP/Nodemailer;
- AWS SES;
- Resend;
- SendGrid hoặc provider khác.

Port:

```ts
export interface MailerPort {
  sendEmailVerification(input: {
    recipient: string;
    verificationUrl: string;
    locale: string;
  }): Promise<void>;

  sendPasswordReset(input: {
    recipient: string;
    resetUrl: string;
    locale: string;
  }): Promise<void>;
}
```

Application tạo token và URL. Adapter chịu trách nhiệm render/send.

Email nên được enqueue với template data tối thiểu, không enqueue password hoặc raw token nếu có thể enqueue token record ID rồi resolve an toàn.

---

## 23. External HTTP module

Cài khi có external integration:

```bash
npm install @nestjs/axios axios
```

Tạo client wrapper có:

- base URL;
- timeout;
- default headers;
- correlation ID;
- error mapping;
- retry policy cụ thể từng service.

Mỗi upstream nên có adapter riêng, ví dụ:

```text
src/infrastructure/http/virus-scanner/
src/infrastructure/http/search-service/
src/infrastructure/http/oauth-provider/
```

Không tạo một `ExternalApiService` chung chứa hàng chục endpoint không liên quan.

---

# PHASE 6 — OBSERVABILITY

## 24. Structured logger

Có thể bắt đầu bằng Nest logger, sau đó chuyển sang structured logger khi deployment cần log aggregation.

Mọi log infrastructure nên có:

```ts
{
  component: 'database' | 'redis' | 'queue' | 'storage',
  operation: string,
  requestId?: string,
  correlationId?: string,
  durationMs?: number,
  retryAttempt?: number,
}
```

Dùng request context store hiện có để tự động gắn request metadata.

Redact theo constants hiện có trước khi serialize.

---

## 25. Metrics

Tối thiểu theo dõi:

```text
http_request_duration
http_errors_total
database_query_errors_total
redis_operation_duration
cache_hit_total
cache_miss_total
queue_jobs_active
queue_jobs_failed_total
outbox_pending_count
outbox_oldest_pending_age
storage_operation_errors_total
```

Không dùng label có cardinality cao như raw URL chứa UUID, userId hoặc exception message.

---

## 26. Tracing

Khi triển khai OpenTelemetry:

- propagate `traceparent` qua HTTP và queue metadata;
- map request ID/correlation ID sang span attributes;
- trace database, Redis, queue và external HTTP;
- không ghi secret vào span.

Tracing nên là phase sau khi logging và metrics cơ bản đã ổn định.

---

# COMPOSITION VÀ CONFIG

## 27. `infrastructure.module.ts`

Chỉ import subsystem đã sẵn sàng:

```ts
import { Module } from '@nestjs/common';

import { PrismaModule } from './database';
import { StorageModule } from './storage';

@Module({
  imports: [PrismaModule, StorageModule],
  exports: [PrismaModule, StorageModule],
})
export class InfrastructureModule {}
```

Không thêm Redis/queue bằng import giả khi chưa có dependency/config/test.

`AppModule`:

```ts
@Module({
  imports: [
    AppConfigModule,
    InfrastructureModule,
    HealthModule,
    StoriesModule,
  ],
})
export class AppModule {}
```

Feature module vẫn có thể import focused module trực tiếp thay vì toàn bộ aggregator.

---

## 28. Environment variables đề xuất

Chỉ thêm biến khi subsystem tương ứng được triển khai.

```env
# Database
DATABASE_URL=postgresql://app:password@localhost:5432/quan_ly_truyen
DIRECT_DATABASE_URL=postgresql://app:password@localhost:5432/quan_ly_truyen
DB_HEALTH_TIMEOUT_MS=3000

# Storage
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=./var/storage
PUBLIC_ASSET_BASE_URL=http://localhost:3000/api/v1/media

# Redis
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=qlt
CACHE_DEFAULT_TTL_SECONDS=300

# Queue
QUEUE_ENABLED=false
QUEUE_PREFIX=qlt
WORKER_CONCURRENCY=5

# Outbox
OUTBOX_BATCH_SIZE=100
OUTBOX_POLL_INTERVAL_MS=1000
OUTBOX_MAX_ATTEMPTS=10

# Mail
MAIL_ENABLED=false
MAIL_PROVIDER=smtp
MAIL_FROM=no-reply@example.com
```

Trong Prisma 7, nếu runtime đi qua pooled URL nhưng migration cần direct URL, cấu hình `prisma.config.ts` dùng direct URL cho CLI và `PrismaPg` dùng runtime URL.

Ví dụ:

```ts
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_DATABASE_URL'),
  },
});
```

Development không có pooler có thể đặt hai URL giống nhau.

---

# TESTING VÀ CI

## 29. Test pyramid cho infrastructure

### Database

- repository integration với PostgreSQL;
- constraint và transaction;
- migration smoke test.

### Redis

- TTL;
- serialization;
- lock atomicity;
- idempotency claim.

### Storage

- temporary local directory;
- path traversal;
- upload/delete;
- S3 adapter bằng test environment hoặc emulator phù hợp.

### Queue/outbox

- retry;
- duplicate delivery;
- worker crash recovery;
- multi-worker claim;
- poison job.

### Health

- live luôn up khi process chạy;
- ready down khi dependency bắt buộc down;
- không leak secret.

---

## 30. CI pipeline tối thiểu

```text
1. npm ci
2. prisma generate
3. eslint
4. type-check/build
5. start PostgreSQL service
6. migrate deploy
7. integration tests
8. start Redis service khi Redis phase được bật
9. queue/storage tests
10. e2e tests
```

Không chạy `prisma migrate reset` trên staging/production CI job.

---

# LỘ TRÌNH COMMIT

## 31. Thứ tự commit khuyến nghị

### Commit 1

```text
feat(config): add validated database configuration
```

### Commit 2

```text
feat(infrastructure): add prisma module and lifecycle
```

### Commit 3

```text
feat(health): add live and database readiness endpoints
```

### Commit 4

```text
refactor(stories): add repository port and prisma adapter
```

### Commit 5

```text
feat(storage): add local storage adapter and media workflow
```

### Commit 6

```text
feat(redis): add cache store and health indicator
```

### Commit 7

```text
feat(infrastructure): add distributed lock and idempotency store
```

### Commit 8

```text
feat(queue): add BullMQ queues and worker bootstrap
```

### Commit 9

```text
feat(events): add transactional outbox dispatcher
```

### Commit 10

```text
feat(observability): add metrics and structured infrastructure logs
```

Mỗi commit phải build và test độc lập.

---

# CHECKLIST HOÀN THÀNH

## 32. Database

- [ ] Chỉ một Prisma client provider.
- [ ] Prisma 7 driver adapter được truyền vào client.
- [ ] Generated import path đúng.
- [ ] Connect/disconnect lifecycle hoạt động.
- [ ] Repository feature không nằm trong common.
- [ ] Error mapper không leak SQL/secret.
- [ ] Transaction/outbox được test.

## 33. Health

- [ ] `/api/v1/health/live` hoạt động.
- [ ] `/api/v1/health/ready` kiểm tra PostgreSQL.
- [ ] Health paths bypass maintenance.
- [ ] Shutdown hooks được bật.
- [ ] Health response không qua auth.

## 34. Storage

- [ ] Local provider chỉ dùng dev/test.
- [ ] Storage key do server tạo.
- [ ] Path traversal bị chặn.
- [ ] MIME/size/checksum được kiểm tra.
- [ ] Media status transition đúng.
- [ ] Có cleanup cho orphan/failed assets.

## 35. Redis và queue

- [ ] Redis client chỉ tạo một lần.
- [ ] Cache có TTL và versioned key.
- [ ] Lock release kiểm tra owner token.
- [ ] Idempotency claim atomic.
- [ ] Job payload có version.
- [ ] Consumer idempotent.
- [ ] Outbox claim an toàn khi nhiều worker.
- [ ] Failed jobs/outbox có khả năng quan sát và replay.

## 36. Security và operations

- [ ] Không log secret/token/password.
- [ ] External call có timeout.
- [ ] Retry có giới hạn và phân loại lỗi.
- [ ] Production không phụ thuộc local disk.
- [ ] Config fail-fast khi thiếu biến bắt buộc.
- [ ] Integration test chạy với dependency thật.
- [ ] Metrics không có high-cardinality labels.

---

## 37. Definition of Done

Infrastructure phase đầu được xem là hoàn thành khi:

1. Backend build và test thành công với Prisma provider mới.
2. Không còn nơi nào tự tạo `PrismaClient` ngoài `PrismaService`.
3. Một feature repository đã chứng minh dependency inversion hoạt động.
4. Database transaction và error mapping có integration test.
5. Liveness/readiness được sử dụng bởi Docker hoặc deployment platform.
6. Shutdown đóng database/Redis/worker đúng cách.
7. Các subsystem chưa triển khai được tắt rõ ràng bằng config, không có provider giả.
8. Tài liệu `.env.example`, Docker Compose và runbook được cập nhật cùng code.

---

## 38. Tài liệu tham khảo chính thức

- Prisma Client setup: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction
- Prisma ORM 7 upgrade: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- Prisma database connections: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- NestJS Terminus: https://docs.nestjs.com/recipes/terminus
- NestJS queues: https://docs.nestjs.com/techniques/queues
- NestJS dynamic modules: https://docs.nestjs.com/fundamentals/dynamic-modules
