# Common Middlewares

## Mục tiêu

Middleware chỉ xử lý các việc phải diễn ra trước guard:

- tạo request ID/correlation ID;
- mở AsyncLocalStorage context cho toàn request;
- xác định locale kỹ thuật;
- chặn maintenance mode trước authentication;
- kiểm tra Content-Type cho route JSON được chọn.

Không đặt authentication, role, permission, ownership, logging response, timeout hay response envelope vào middleware.

## Cấu trúc

```text
src/common/middlewares/
├── common-middlewares.constants.ts
├── common-middlewares-options.interface.ts
├── common-middlewares.module.ts
├── json-content-type.middleware.ts
├── locale.middleware.ts
├── maintenance-mode.middleware.ts
├── middleware-request.util.ts
├── request-context.interface.ts
├── request-context.middleware.ts
├── request-context.store.ts
└── index.ts
```

## Đăng ký module

```ts
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import {
  CommonMiddlewaresModule,
  JsonContentTypeMiddleware,
  LocaleMiddleware,
  MaintenanceModeMiddleware,
  RequestContextMiddleware,
} from './common/middlewares';

@Module({
  imports: [
    CommonMiddlewaresModule.register({
      requestContext: {
        trustIncomingRequestId: true,
        trustIncomingCorrelationId: true,
      },
      locale: {
        defaultLocale: 'vi-VN',
        supportedLocales: ['vi-VN', 'en-US'],
      },
      maintenance: {
        resolveState: () => ({
          enabled: process.env.MAINTENANCE_MODE === 'true',
          message: 'Hệ thống đang bảo trì',
          retryAfterSeconds: 300,
        }),
        allowedPaths: ['/api/v1/health'],
        bypassHeaderName: 'x-maintenance-key',
        bypassToken: process.env.MAINTENANCE_BYPASS_TOKEN,
      },
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Thứ tự có chủ đích: context trước tất cả middleware còn lại.
    consumer
      .apply(
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
      )
      .forRoutes({
        path: '{*path}',
        method: RequestMethod.ALL,
      });

    // Chỉ gắn cho API JSON. Không gắn vào upload/webhook raw body.
    consumer
      .apply(JsonContentTypeMiddleware)
      .exclude(
        { path: 'api/v1/media/upload', method: RequestMethod.POST },
        { path: 'api/v1/webhooks/{*path}', method: RequestMethod.ALL },
      )
      .forRoutes({
        path: 'api/v1/{*path}',
        method: RequestMethod.ALL,
      });
  }
}
```

NestJS 11 dùng wildcard được đặt tên như `{*path}`. Nếu dự án đang ở NestJS 10, điều chỉnh route wildcard theo phiên bản đang dùng.

## RequestContextMiddleware

Middleware này là nguồn duy nhất tạo:

```text
request.requestId
request.correlationId
request.requestContext
x-request-id response header
x-correlation-id response header
```

Nó chạy trước guard, vì vậy ngay cả lỗi JWT/permission cũng có request ID để filter log và trả về client.

Request context được bọc bằng `AsyncLocalStorage`:

```ts
@Injectable()
export class StoryService {
  constructor(
    private readonly requestContext: RequestContextStore,
  ) {}

  execute(): void {
    const context = this.requestContext.require();

    console.log(context.requestId);
  }
}
```

Sau khi JWT strategy xác thực, có thể bổ sung user/session vào context:

```ts
this.requestContext.patch({
  userId: user.id,
  sessionId: session.id,
});
```

### Không tin mù quáng ID từ client

Middleware chỉ chấp nhận request/correlation ID:

- không rỗng;
- tối đa 128 ký tự mặc định;
- chỉ chứa chữ, số, `.`, `_`, `:`, `-`.

Có thể tắt việc tin header ngoài:

```ts
requestContext: {
  trustIncomingRequestId: false,
  trustIncomingCorrelationId: false,
}
```

## LocaleMiddleware

Locale được lấy từ `Accept-Language`, có xét `q=` và fallback theo language tag:

```text
Accept-Language: en-GB,en;q=0.9,vi;q=0.8
supported: vi-VN, en-US
result: en-US
```

Middleware ghi:

```text
request.locale
request.requestContext.locale
Content-Language response header
```

Đây chỉ là locale kỹ thuật. Ngôn ngữ nội dung truyện vẫn là dữ liệu nghiệp vụ và thuộc module stories/chapters.

## MaintenanceModeMiddleware

Middleware chặn sớm trước guard/controller. Resolver có thể đọc env, Redis hoặc feature flag service. Lỗi được chuyển qua `next(error)` thay vì tự ghi response, để exceptions layer xử lý thống nhất.

Thiết kế fail-open: nếu resolver lỗi, request vẫn đi tiếp. Điều này tránh việc lỗi hệ thống cấu hình tự biến toàn bộ API thành 503. Hãy log/monitor lỗi resolver tại provider triển khai thực tế.

Health endpoint nên luôn nằm trong `allowedPaths`.

Bypass token chỉ dành cho kiểm tra nội bộ và được so sánh bằng `timingSafeEqual()`. Không log header bypass.

## JsonContentTypeMiddleware

Middleware chỉ kiểm tra các request mutation có body:

```text
POST
PUT
PATCH
```

Chấp nhận:

```text
application/json
application/problem+json
application/vnd.example+json
```

Không gắn middleware này vào:

```text
multipart/form-data upload
application/x-www-form-urlencoded
raw webhook signature endpoint
GraphQL nếu transport có quy ước riêng
```

Validation nội dung body vẫn thuộc `ValidationPipe`; middleware này chỉ kiểm tra media type.

## Bắt buộc sửa phần interceptor cũ

Sau khi dùng `RequestContextMiddleware`, xóa `RequestContextInterceptor` khỏi danh sách `APP_INTERCEPTOR` để không tạo ID/context lần hai.

`CommonInterceptorsModule` chỉ còn:

```text
LoggingInterceptor
TimeoutInterceptor
ResponseEnvelopeInterceptor
```

`LoggingInterceptor` đọc context đã có từ request hoặc `RequestContextStore`; nó không được tự sinh request ID.

Có thể giữ file tương thích:

```ts
// src/common/interceptors/request-context.interface.ts
export type {
  MiddlewareHttpRequest as HttpRequestWithContext,
  MutableRequestContext as RequestContextData,
} from '../middlewares';
```

Không cần giữ `request-context.interceptor.ts`.

## Không tạo các middleware sau

```text
AuthMiddleware
JwtMiddleware
RolesMiddleware
PermissionsMiddleware
StoryOwnershipMiddleware
RequestLoggingMiddleware
TimeoutMiddleware
ResponseTransformMiddleware
GlobalValidationMiddleware
```

Phân công đúng:

```text
JWT / role / permission     -> guards
ownership / business state -> application policy
validation / transformation -> pipes
logging / timeout / response -> interceptors
error mapping               -> filters
request bootstrap           -> middlewares
```

## Thứ tự lifecycle

```text
RequestContextMiddleware
LocaleMiddleware
MaintenanceModeMiddleware
JsonContentTypeMiddleware
        ↓
Global Guards
        ↓
Interceptors
        ↓
Pipes
        ↓
Controller / Application
        ↓
Response Interceptors
```
