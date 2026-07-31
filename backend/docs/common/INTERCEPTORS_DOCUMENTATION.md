# Common Interceptors Documentation

## Cấu trúc

```text
src/common/interceptors/
├── api-success-response.interface.ts
├── common-interceptors.constants.ts
├── common-interceptors.module.ts
├── interceptor-metadata.constants.ts
├── logging.interceptor.ts
├── request-context.interface.ts
├── request-context.interceptor.ts
├── request-context.util.ts
├── response-envelope.interceptor.ts
├── timeout.interceptor.ts
└── index.ts
```

## Trách nhiệm

### RequestContextInterceptor

- Lấy hoặc sinh `requestId`.
- Lấy hoặc sinh `correlationId`.
- Gắn `request.requestId`, `request.correlationId`, `request.requestContext`.
- Trả header `x-request-id` và `x-correlation-id`.
- Không tin tưởng vô điều kiện ID do client gửi lên; giá trị quá dài hoặc có ký tự lạ sẽ bị bỏ qua.

### LoggingInterceptor

- Chỉ log request HTTP hoàn tất thành công.
- Ghi method, path, status, thời gian xử lý, request ID, handler và user ID nếu có.
- Không log body, token, cookie hoặc credential.
- Lỗi được log bởi `AllExceptionsFilter` để tránh log trùng.

### TimeoutInterceptor

- Timeout mặc định: 15 giây.
- Khi hết thời gian sẽ ném `RequestTimeoutException` từ `src/common/exceptions`.
- Có thể override hoặc bỏ timeout theo metadata.

### ResponseEnvelopeInterceptor

Chuyển kết quả controller:

```json
{
  "id": "story-id",
  "title": "Tên truyện"
}
```

thành:

```json
{
  "success": true,
  "data": {
    "id": "story-id",
    "title": "Tên truyện"
  },
  "requestId": "...",
  "timestamp": "2026-07-31T08:00:00.000Z"
}
```

Không wrap:

- `StreamableFile`.
- Kết quả đã có `success: true` hoặc `success: false`.
- Route/controller có metadata `SKIP_RESPONSE_ENVELOPE_KEY`.

## Đăng ký

```ts
import { Module } from '@nestjs/common';

import { CommonFiltersModule } from './common/filters';
import { CommonInterceptorsModule } from './common/interceptors';

@Module({
  imports: [
    CommonFiltersModule,
    CommonInterceptorsModule,
  ],
})
export class AppModule {}
```

Không đăng ký lại cùng các interceptor bằng `app.useGlobalInterceptors()`.

## Metadata theo route

Trước khi tạo custom decorators, có thể dùng `SetMetadata` trực tiếp:

```ts
import { SetMetadata } from '@nestjs/common';
import {
  REQUEST_TIMEOUT_MS_KEY,
  SKIP_REQUEST_LOGGING_KEY,
  SKIP_REQUEST_TIMEOUT_KEY,
  SKIP_RESPONSE_ENVELOPE_KEY,
} from '@/common/interceptors';

@SetMetadata(REQUEST_TIMEOUT_MS_KEY, 30_000)
@Get(':id')
findOne() {}

@SetMetadata(SKIP_REQUEST_TIMEOUT_KEY, true)
@Get('events')
streamEvents() {}

@SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true)
@Get('export')
exportFile() {}

@SetMetadata(SKIP_REQUEST_LOGGING_KEY, true)
@Get('health')
health() {}
```

## Thứ tự global interceptor

Module đăng ký theo thứ tự:

```text
RequestContext → Logging → Timeout → ResponseEnvelope → Controller
```

Ở chiều response, thứ tự chạy ngược lại.

## Lưu ý

- Controller nên `return` dữ liệu theo cơ chế chuẩn của NestJS.
- Không dùng native `@Res()` trực tiếp trên route cần response envelope.
- `ClassSerializerInterceptor` có thể được đăng ký trước `ResponseEnvelopeInterceptor` nếu dự án dùng class-transformer để ẩn field.
- Không đưa idempotency vào interceptor chung khi chưa có `IdempotencyStorePort`; idempotency cần storage atomic và chính sách riêng cho từng write endpoint.
