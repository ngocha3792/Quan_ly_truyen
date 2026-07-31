# UPDATE PLAN — `src/common`

> Dự án: **Quản lý truyện — NestJS**  
> Phạm vi: rà soát và tinh gọn `backend/src/common`  
> Mục tiêu: loại bỏ định nghĩa trùng, thống nhất contract, tận dụng code dùng chung và bảo đảm các thành phần `common` thực sự được đăng ký khi ứng dụng chạy.

---

## 1. Đánh giá hiện tại

`src/common` hiện đã **đủ về số lượng thành phần**, thậm chí có một số abstraction chưa cần thiết. Không nên tiếp tục thêm util, decorator, exception hoặc interface mới trước khi hoàn thành đợt refactor này.

Các vấn đề chính:

- Một số enum/interface được khai báo nhiều lần và đã lệch cấu trúc.
- Middleware, pipe, decorator và filter đang tự viết lại logic mà `utils` hoặc `constants` đã có.
- Custom exceptions đã tồn tại nhưng một số nơi vẫn dùng exception mặc định của NestJS.
- Global filter và validation pipe chưa được kết nối vào runtime.
- Một số decorator chỉ ghi metadata nhưng chưa có interceptor/service đọc metadata đó.

---

# 2. Thứ tự ưu tiên

## P0 — Phải xử lý trước khi phát triển module nghiệp vụ

- [ ] Chỉ giữ một `ExceptionCategory`.
- [ ] Chỉ giữ một `ValidationIssue`.
- [ ] Thống nhất success/error response contract.
- [ ] Thống nhất request context.
- [ ] Thống nhất principal sau khi xác thực JWT.
- [ ] Đăng ký global exception filter.
- [ ] Đăng ký global validation pipe.
- [ ] Chạy build, lint và test sau từng nhóm thay đổi.

## P1 — Tinh gọn và tái sử dụng code

- [ ] Dùng chung request/header utilities.
- [ ] Dùng lại `ip.util.ts` trong decorator và middleware.
- [ ] Dùng lại `escapeRegExp` từ `string.util.ts`.
- [ ] Dùng lại `normalizeEmail` trong validation decorator.
- [ ] Dùng `security.constants.ts` trong `redact.util.ts`.
- [ ] Thay header string hardcode bằng `HTTP_HEADERS`.
- [ ] Xóa các file chỉ re-export constants không cần thiết.

## P2 — Dọn abstraction chưa sử dụng

- [ ] Quyết định giữ hay tạm xóa `@CacheTtl()`.
- [ ] Quyết định giữ hay tạm xóa `@Idempotent()`.
- [ ] Kiểm tra các injection token chưa có provider/consumer.
- [ ] Chuyển type riêng của Story ra khỏi `common`.

---

# 3. Kế hoạch thay đổi chi tiết

## Bước 0 — Tạo baseline trước khi refactor

Tạo branch riêng:

```bash
git checkout -b refactor/common-cleanup
```

Cài dependency và kiểm tra trạng thái ban đầu:

```bash
cd backend
npm ci
npm run build
npm run lint
npm test
```

Nếu trạng thái ban đầu đã lỗi, ghi lại lỗi vào PR/commit để phân biệt lỗi cũ và lỗi do refactor.

---

## Bước 1 — Gộp `ExceptionCategory`

### Đang bị lặp

```text
src/common/enums/exception-category.enum.ts
src/common/exceptions/exception-category.enum.ts
```

### Việc cần làm

- [ ] Giữ `src/common/exceptions/exception-category.enum.ts` làm nguồn duy nhất.
- [ ] Bổ sung category còn thiếu vào bản được giữ nếu thực sự cần.
- [ ] Xóa `src/common/enums/exception-category.enum.ts`.
- [ ] Xóa export tương ứng khỏi `src/common/enums/index.ts`.
- [ ] Tìm và sửa toàn bộ import cũ.

Kiểm tra:

```bash
rg "ExceptionCategory" src
npm run build
```

### Tiêu chí hoàn thành

Toàn bộ dự án chỉ còn một khai báo:

```ts
export enum ExceptionCategory { ... }
```

---

## Bước 2 — Gộp `ValidationIssue`

### Đang bị lặp

```text
src/common/exceptions/validation-issue.interface.ts
src/common/interfaces/http/api-error.interface.ts
src/common/pipes/app-validation.pipe.ts
```

### Việc cần làm

- [ ] Giữ `src/common/exceptions/validation-issue.interface.ts`.
- [ ] Xóa interface cục bộ trong `app-validation.pipe.ts`.
- [ ] Cho API error contract import `ValidationIssue` thay vì khai báo lại.
- [ ] Export type từ `src/common/exceptions/index.ts`.

Trong pipe, sử dụng:

```ts
import {
  ValidationException,
  type ValidationIssue,
} from '@/common/exceptions';
```

### Nên đổi exception factory

Không trả `BadRequestException` mặc định của NestJS. Hãy trả custom exception:

```ts
exceptionFactory: (errors: ValidationError[]) =>
  new ValidationException({
    issues: flattenValidationErrors(errors),
  }),
```

### Tiêu chí hoàn thành

- Chỉ còn một `ValidationIssue`.
- Mọi lỗi DTO validation đi qua `ValidationException`.
- `AllExceptionsFilter` nhận được cấu trúc lỗi thống nhất.

---

## Bước 3 — Thống nhất API response contract

### Các contract đang chồng chéo

```text
src/common/interfaces/http/api-response.interface.ts
src/common/interfaces/http/api-error.interface.ts
src/common/interceptors/api-success-response.interface.ts
src/common/filters/normalized-exception.interface.ts
```

### Cấu trúc đề xuất

Giữ contract công khai tại:

```text
src/common/interfaces/http/api-response.interface.ts
```

```ts
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
  requestId: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
  requestId: string;
  timestamp: string;
  path: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

### Việc cần làm

- [ ] Chuyển `ApiSuccessResponse<T>` vào HTTP interfaces.
- [ ] Thống nhất tên `details`; không dùng lẫn `details` và `metadata`.
- [ ] Quy định `path`, `requestId`, `timestamp` là bắt buộc ở error response.
- [ ] Cho `ResponseEnvelopeInterceptor` import contract dùng chung.
- [ ] Cho `AllExceptionsFilter` import contract dùng chung.
- [ ] Xóa `src/common/interceptors/api-success-response.interface.ts`.
- [ ] Bỏ `ApiErrorResponse` khỏi `normalized-exception.interface.ts`.

### Lưu ý

`NormalizedException` là model nội bộ của filter; `ApiErrorResponse` là contract trả ra client. Không gộp hai khái niệm thành một interface.

---

## Bước 4 — Thống nhất request context

### Các type hiện tại

```text
src/common/interfaces/http/request-context.interface.ts
src/common/middlewares/request-context.interface.ts
src/common/interceptors/request-context.interface.ts
src/common/interfaces/auth/auth-context.interface.ts
```

### Cấu trúc đề xuất

Nguồn duy nhất:

```text
src/common/interfaces/http/request-context.interface.ts
```

```ts
export interface RequestContext {
  requestId: string;
  correlationId: string;
  method: string;
  path: string;
  startedAt: Date;
  principal: AuthPrincipal | null;
  locale?: string;
  ipAddress?: string;
  userAgent?: string;
}
```

Tạo adapter cho Express request nếu cần:

```ts
export interface RequestWithContext extends Request {
  requestContext?: RequestContext;
  requestId?: string;
  correlationId?: string;
  user?: AuthPrincipal;
}
```

### Việc cần làm

- [ ] Chọn một `RequestContext` chuẩn.
- [ ] Cho middleware, filter, interceptor và decorator import cùng type.
- [ ] Xóa `src/common/interceptors/request-context.interface.ts` nếu chỉ re-export.
- [ ] Rút gọn `src/common/middlewares/request-context.interface.ts` thành Express adapter hoặc xóa nếu không cần.
- [ ] Không để interceptor phụ thuộc vào folder middleware.

### Tiêu chí hoàn thành

```bash
rg "interface RequestContext" src/common
```

Chỉ trả về một interface nghiệp vụ chính.

---

## Bước 5 — Thống nhất principal và JWT claims

### Các representation hiện tại

```text
AuthPrincipal
GuardPrincipal
JwtPayload
CommonJwtClaims
```

JWT payload là dữ liệu token; principal là identity đã được ứng dụng chuẩn hóa. Guards và decorators chỉ nên dùng principal.

### Luồng đề xuất

```text
JWT payload (`sub`, `sid`)
        ↓ JWT strategy validate/normalize
AuthPrincipal (`userId`, `sessionId`)
        ↓
guards, decorators, request context
```

### `AuthPrincipal` đề xuất

```ts
export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  email?: string;
  emailVerified: boolean;
  roles: RoleCode[];
  permissions: PermissionCode[];
  authorProfileId?: string;
}
```

### Việc cần làm

- [ ] Bổ sung field guards đang cần vào `AuthPrincipal`.
- [ ] JWT strategy chuyển `sub` thành `userId` và `sid` thành `sessionId`.
- [ ] Cho `RolesGuard`, `PermissionsGuard`, `VerifiedEmailGuard` dùng `AuthPrincipal`.
- [ ] Xóa `guard-principal.interface.ts`.
- [ ] Bỏ các fallback kiểu `userId ?? sub` sau khi normalize ở strategy.

---

## Bước 6 — Dùng custom exception nhất quán

Custom exceptions đã tồn tại nhưng một số nơi vẫn import từ `@nestjs/common`.

### Middleware cần sửa

```text
src/common/middlewares/json-content-type.middleware.ts
src/common/middlewares/maintenance-mode.middleware.ts
```

Sử dụng:

```ts
import {
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@/common/exceptions';
```

### Pipes cần sửa

```text
src/common/pipes/app-validation.pipe.ts
src/common/pipes/parse-iso-date.pipe.ts
src/common/pipes/parse-optional-uuid.pipe.ts
src/common/pipes/parse-positive-int.pipe.ts
```

Thay `BadRequestException` bằng `InvalidInputException` hoặc `ValidationException`, tùy loại lỗi.

### Quy tắc

- DTO/class-validator lỗi → `ValidationException`.
- Giá trị route/query parse không hợp lệ → `InvalidInputException`.
- Không được xác thực → exception nhóm authentication.
- Đã xác thực nhưng thiếu quyền → exception nhóm authorization.
- Lỗi hạ tầng → infrastructure exception tương ứng.

### Tiêu chí hoàn thành

```bash
rg "BadRequestException|UnsupportedMediaTypeException|ServiceUnavailableException" src/common
```

Các kết quả còn lại phải có lý do rõ ràng; không được vô tình import class cùng tên từ NestJS.

---

## Bước 7 — Tạo request utility dùng chung

Các hàm đọc header/request đang được viết lại tại middleware, filter và decorators.

Tạo:

```text
src/common/utils/http-request.util.ts
```

API đề xuất:

```ts
export function asNonEmptyString(value: unknown): string | undefined;

export function readHeader(
  headers: unknown,
  name: string,
): string | undefined;

export function resolveRequestId(request: HttpRequestLike): string;

export function resolveCorrelationId(
  request: HttpRequestLike,
): string;

export function resolveRequestPath(request: HttpRequestLike): string;
```

### Việc cần làm

- [ ] Chuyển `nonEmptyString`/`readHeader` từ middleware và filter vào util.
- [ ] Cho request ID decorator dùng util chung.
- [ ] Cho correlation ID decorator dùng util chung.
- [ ] Export từ `src/common/utils/index.ts`.
- [ ] Xóa implementation bị lặp.

---

## Bước 8 — Tận dụng các util đã tồn tại

### IP address

Đã có:

```text
src/common/utils/ip.util.ts
```

- [ ] `client-ip.decorator.ts` dùng `resolveClientIp()`.
- [ ] `middleware-request.util.ts` dùng `resolveClientIp()`.
- [ ] Xóa logic parse `x-forwarded-for` bị lặp.

### Escape RegExp

Đã có bản public tại:

```text
src/common/utils/string.util.ts
```

- [ ] Import `escapeRegExp` vào `slug.util.ts`.
- [ ] Xóa function cục bộ trong `slug.util.ts`.

### Normalize email

- [ ] `normalize-email.decorator.ts` gọi `normalizeEmail()` từ utils.
- [ ] Không tự viết lại `trim().toLowerCase()`.

### Redact sensitive data

Đã có constants:

```text
src/common/constants/security.constants.ts
```

- [ ] `redact.util.ts` import `SENSITIVE_FIELD_NAMES`.
- [ ] `redact.util.ts` import `REDACTED_VALUE`.
- [ ] Xóa danh sách sensitive fields cục bộ.

---

## Bước 9 — Dùng constants thay chuỗi hardcode

Kiểm tra các file:

```text
request-context.middleware.ts
locale.middleware.ts
json-content-type.middleware.ts
maintenance-mode.middleware.ts
middleware-request.util.ts
request-metadata.util.ts
all-exceptions.filter.ts
```

### Việc cần làm

- [ ] Dùng `HTTP_HEADERS.REQUEST_ID`.
- [ ] Dùng `HTTP_HEADERS.CORRELATION_ID`.
- [ ] Dùng `HTTP_HEADERS.ACCEPT_LANGUAGE`.
- [ ] Dùng `HTTP_HEADERS.CONTENT_TYPE`.
- [ ] Dùng `HTTP_HEADERS.RETRY_AFTER`.
- [ ] Bổ sung `CONTENT_LANGUAGE` vào constants nếu ứng dụng sử dụng header này.
- [ ] Không hardcode cùng một header ở nhiều nơi.

---

## Bước 10 — Dọn type và constants nhỏ bị lặp

### Token type

Đang có cả `AUTH_TOKEN_TYPES` và `JwtTokenType`.

- [ ] Giữ `JwtTokenType` nếu payload/domain code đang dùng enum.
- [ ] Xóa constant trùng nếu không có consumer đặc biệt.

### Sort direction

- [ ] Cho `SortOption.direction` dùng `SortDirection`.
- [ ] Không dùng song song enum và union `'asc' | 'desc'`.

### Pagination metadata

- [ ] Giữ một pagination meta interface.
- [ ] Cho `createPageMeta()` trả về interface trong `interfaces/pagination`.
- [ ] Xóa `PageMeta` cục bộ nếu trùng hoàn toàn.

### Story cursor

Nếu `StoryCursor` đang nằm trong `common`:

- [ ] Chuyển sang `modules/stories/interfaces/story-cursor.interface.ts`.
- [ ] `common` chỉ giữ cursor pagination generic.

---

## Bước 11 — Xóa các file re-export không tạo giá trị

Kiểm tra:

```text
src/common/interceptors/interceptor-metadata.constants.ts
src/common/interceptors/common-interceptors.constants.ts
```

Nếu chúng chỉ re-export constants từ `common/constants`:

- [ ] Cho interceptor import trực tiếp từ `@/common/constants`.
- [ ] Xóa hai file trung gian.
- [ ] Sửa `interceptors/index.ts`.

Không xóa barrel `index.ts` chính của từng folder; chỉ xóa layer trung gian không có logic hoặc contract riêng.

---

# 4. Kết nối các thành phần vào runtime

## Bước 12 — Đăng ký global exception filter

`CommonFiltersModule` đã cung cấp `APP_FILTER`, nhưng hiện chưa được import vào `AppModule`.

Sửa `src/app.module.ts`:

```ts
import { CommonFiltersModule } from './common/filters';

@Module({
  imports: [
    CommonMiddlewaresModule.register(...),
    CommonInterceptorsModule,
    CommonFiltersModule,
  ],
})
export class AppModule {}
```

- [ ] Import `CommonFiltersModule`.
- [ ] Gửi một request gây lỗi và xác nhận response đi qua envelope chuẩn.
- [ ] Xác nhận response có `requestId`, `timestamp`, `path`, `code`.

---

## Bước 13 — Đăng ký global validation pipe

Hiện `main.ts` chưa sử dụng `AppValidationPipe`.

```ts
import { AppValidationPipe } from './common/pipes';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new AppValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}
```

- [ ] Đăng ký pipe.
- [ ] Kiểm tra `whitelist`.
- [ ] Kiểm tra `forbidNonWhitelisted` theo chính sách dự án.
- [ ] Kiểm tra transform query/path DTO.
- [ ] Xác nhận validation error đi qua `AllExceptionsFilter`.

Có thể dùng `APP_PIPE` trong module nếu muốn quản lý hoàn toàn qua dependency injection. Chỉ chọn một cách, không đăng ký cả hai.

---

## Bước 14 — Chỉ đăng ký global guards khi JWT strategy sẵn sàng

`CommonGuardsModule` không nên được import mù quáng nếu chưa có strategy `jwt-access`.

Trước khi bật:

- [ ] Có Passport JWT strategy tên đúng với `JwtAuthGuard`.
- [ ] Strategy kiểm tra token và session.
- [ ] Strategy trả về `AuthPrincipal` chuẩn.
- [ ] Có cơ chế `@Public()` để bỏ qua authentication.
- [ ] Roles guard và permissions guard đọc đúng metadata.
- [ ] Có test cho public route, authenticated route và forbidden route.

Sau đó mới import `CommonGuardsModule` vào `AppModule` hoặc auth module phù hợp.

---

# 5. Abstraction chưa có consumer

## `@CacheTtl()`

Hiện decorator ghi `CACHE_TTL_SECONDS_KEY`, nhưng chưa thấy interceptor/service đọc metadata.

Chọn một trong hai:

### Phương án A — Chưa làm cache

- [ ] Tạm xóa decorator và metadata key.
- [ ] Thêm lại khi triển khai cache interceptor.

### Phương án B — Sắp triển khai cache

- [ ] Viết cache interceptor.
- [ ] Đọc metadata bằng `Reflector`.
- [ ] Chỉ cache GET/public-safe response.
- [ ] Định nghĩa cache key và invalidation.
- [ ] Đăng ký provider/cache store.
- [ ] Có test cache hit, miss và expiration.

## `@Idempotent()`

Hiện decorator ghi metadata nhưng chưa có consumer.

Chọn một trong hai:

### Phương án A — Chưa làm idempotency

- [ ] Tạm xóa decorator, metadata và injection token không dùng.

### Phương án B — Sắp triển khai idempotency

- [ ] Viết idempotency interceptor/guard.
- [ ] Yêu cầu idempotency key cho operation cần bảo vệ.
- [ ] Lưu trạng thái processing/completed/failed.
- [ ] Xử lý request đồng thời.
- [ ] Định nghĩa TTL.
- [ ] Không lưu nhầm response chứa dữ liệu nhạy cảm.
- [ ] Có test duplicate request và concurrency.

---

# 6. Cấu trúc đích đề xuất

```text
src/common/
├── constants/
├── decorators/
│   ├── auth/
│   ├── request/
│   ├── validation/
│   └── interceptor/       # chỉ giữ decorator có consumer
├── enums/
├── exceptions/
├── filters/
├── guards/
├── interceptors/
├── interfaces/
│   ├── auth/
│   ├── http/
│   ├── pagination/
│   ├── audit/
│   ├── event/
│   ├── file/
│   ├── observability/
│   └── security/
├── middlewares/
├── pipes/
└── utils/
    ├── http-request.util.ts
    ├── ip.util.ts
    ├── string.util.ts
    ├── slug.util.ts
    └── ...
```

Nguyên tắc dependency:

```text
constants / enums / interfaces
            ↓
     utils / exceptions
            ↓
middleware / pipes / guards / interceptors / filters
            ↓
        feature modules
```

Không để:

- interceptor import type từ middleware;
- common import domain type cụ thể của Story/Chapter/User module;
- util phụ thuộc vào filter/guard/interceptor;
- module nghiệp vụ dùng đồng thời nhiều response/error contract.

---

# 7. Test cần bổ sung

## Unit tests

- [ ] `ExceptionNormalizer` chuẩn hóa `AppException`.
- [ ] `ExceptionNormalizer` chuẩn hóa `HttpException`.
- [ ] `ExceptionNormalizer` ẩn lỗi không xác định trong production.
- [ ] `AppValidationPipe` flatten nested validation errors.
- [ ] `resolveClientIp` xử lý `x-forwarded-for`.
- [ ] `readHeader` xử lý string và string array.
- [ ] `redactObject` che toàn bộ sensitive fields.
- [ ] `ResponseEnvelopeInterceptor` không bọc response khi có metadata skip.
- [ ] `TimeoutInterceptor` đọc timeout metadata đúng.
- [ ] Roles/permissions guards xử lý metadata và principal đúng.

## E2E tests

- [ ] Request hợp lệ trả success envelope.
- [ ] DTO không hợp lệ trả error envelope.
- [ ] Route không tồn tại trả `RESOURCE_NOT_FOUND` hoặc code chuẩn đã chọn.
- [ ] Content-Type không hợp lệ trả custom unsupported-media-type error.
- [ ] Maintenance mode trả custom service-unavailable error.
- [ ] Public route không yêu cầu JWT.
- [ ] Protected route thiếu JWT trả 401.
- [ ] Thiếu role/permission trả 403.
- [ ] Mọi response lỗi có request ID.

---

# 8. Lệnh kiểm tra sau mỗi phase

```bash
npm run format
npm run lint
npm run build
npm test
npm run test:e2e
```

Tìm khai báo trùng:

```bash
rg "enum ExceptionCategory" src
rg "interface ValidationIssue" src
rg "interface ApiErrorResponse" src
rg "interface RequestContext" src/common
rg "interface GuardPrincipal" src
```

Tìm hardcode và Nest exceptions còn sót:

```bash
rg "x-request-id|x-correlation-id|accept-language|content-type|retry-after" src/common
rg "BadRequestException|UnsupportedMediaTypeException|ServiceUnavailableException" src/common
```

Tìm metadata không có consumer:

```bash
rg "CACHE_TTL_SECONDS_KEY|IDEMPOTENT_KEY" src
```

---

# 9. Commit plan đề xuất

Giữ commit nhỏ để dễ review và rollback:

```text
refactor(common): unify exception category and validation issues
refactor(common): unify API response contracts
refactor(common): consolidate request context and auth principal
refactor(common): reuse request, IP, string and redact utilities
refactor(common): use custom exceptions consistently
refactor(common): replace hardcoded HTTP headers with constants
refactor(common): remove redundant interceptor constant adapters
fix(app): register common filters and global validation pipe
test(common): cover filters pipes guards and response envelope
chore(common): remove unused cache and idempotency abstractions
```

---

# 10. Definition of Done

Đợt refactor `src/common` được xem là hoàn thành khi:

- [ ] Mỗi shared concept chỉ có một source of truth.
- [ ] Không còn `ExceptionCategory`, `ValidationIssue`, API response hoặc request context trùng nhau.
- [ ] Guards dùng một `AuthPrincipal` chuẩn.
- [ ] Middleware/decorator/filter tái sử dụng request và IP utilities.
- [ ] Các pipe/middleware sử dụng custom exceptions nhất quán.
- [ ] Global exception filter hoạt động.
- [ ] Global validation pipe hoạt động.
- [ ] Metadata decorator được consumer đọc hoặc đã bị xóa.
- [ ] `common` không chứa type chỉ dành riêng cho Story module.
- [ ] `npm run lint` thành công.
- [ ] `npm run build` thành công.
- [ ] Unit tests thành công.
- [ ] E2E tests quan trọng thành công.

---

# 11. Việc không nên làm lúc này

- Không tiếp tục thêm exception mới nếu exception hiện có đã biểu đạt đúng ý nghĩa.
- Không thêm generic repository/service vào `common` chỉ để giảm vài dòng code.
- Không tạo thêm wrapper response mới ở từng module.
- Không tạo thêm request/principal interface riêng cho từng guard hoặc interceptor.
- Không bật global JWT guard trước khi strategy và public-route flow hoàn chỉnh.
- Không giữ decorator chỉ để “sau này có thể dùng” nếu chưa có kế hoạch triển khai gần.
- Không refactor toàn bộ 183 file trong một commit duy nhất.

---

## Hành động đầu tiên nên thực hiện

Bắt đầu bằng ba commit P0 sau:

1. Gộp `ExceptionCategory` và `ValidationIssue`.
2. Gộp API response contract.
3. Đăng ký `CommonFiltersModule` và `AppValidationPipe`.

Sau ba bước này, chạy build/test rồi mới tiếp tục request context và principal. Đây là thứ tự ít rủi ro nhất vì giúp chuẩn hóa luồng lỗi trước khi sửa authentication và request lifecycle.
