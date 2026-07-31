# Common Filters Documentation

## Mục tiêu

`src/common/filters` là lớp chuyển lỗi từ domain/application/NestJS sang HTTP response thống nhất. Domain exception không phụ thuộc HTTP; `AllExceptionsFilter` là nơi duy nhất quyết định HTTP status, response envelope và logging.

## Cấu trúc

```text
src/common/filters/
├── all-exceptions.filter.ts
├── common-filters.module.ts
├── exception-category-status.mapper.ts
├── exception-normalizer.ts
├── normalized-exception.interface.ts
├── request-metadata.util.ts
└── index.ts
```

## Đăng ký

Import module đúng một lần trong `AppModule`:

```ts
import { Module } from '@nestjs/common';

import { CommonFiltersModule } from './common/filters';

@Module({
  imports: [CommonFiltersModule],
})
export class AppModule {}
```

Không đăng ký thêm cùng filter bằng `app.useGlobalFilters()` nếu đã dùng `APP_FILTER`.

## Response lỗi

```json
{
  "success": false,
  "error": {
    "code": "STORY_NOT_FOUND",
    "message": "Không tìm thấy truyện",
    "details": {
      "resource": "Story",
      "identifier": "story-id"
    },
    "retryable": false
  },
  "requestId": "request-id",
  "timestamp": "2026-07-31T08:00:00.000Z",
  "path": "/api/v1/stories/story-id"
}
```

## Quy tắc normalize

1. `AppException`: map `ExceptionCategory` sang HTTP status.
2. `HttpException`: giữ status và đọc `code`, `message`, `details`, `issues` nếu có.
3. Object tương thích `http-errors`: đọc `statusCode`, `code`, `message`.
4. Lỗi không xác định: trả `500 / INTERNAL_ERROR`, không lộ message hoặc stack.

## Logging

- Lỗi 4xx được log ở mức `warn`.
- Lỗi 5xx được log ở mức `error` kèm stack.
- Không log body, token, cookie hoặc raw database payload.
- Response luôn có `x-request-id`; ưu tiên `request.requestId`, `request.id`, header `x-request-id`, sau đó mới tự sinh UUID.

## ValidationPipe

Pipe có thể ném:

```ts
throw new BadRequestException({
  code: 'VALIDATION_ERROR',
  message: 'Dữ liệu gửi lên không hợp lệ',
  issues,
});
```

Filter sẽ đưa `issues` vào `error.details.issues`.

## Lưu ý

Filter này dành cho HTTP. WebSocket và microservice/RPC nên có filter riêng sử dụng `WsExceptionFilter` hoặc `RpcExceptionFilter` để giữ đúng semantics của transport.
