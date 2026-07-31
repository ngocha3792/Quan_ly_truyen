# Các Decorator Dùng Chung (Common Decorators)

## Quy ước thư mục

Sử dụng `src/common/decorators` (dạng số nhiều), đây là quy ước phổ biến trong NestJS.
Một file barrel tương thích được bao gồm tại `src/common/decorator/index.ts`, nhưng các đoạn code mới nên import từ `@/common/decorators`.

## Các thư viện phụ thuộc (Dependencies)

```bash
npm install @nestjs/common @nestjs/core class-validator class-transformer
```

Cấu hình TypeScript của bạn phải bật hỗ trợ decorator:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Danh sách các Decorator

### Xác thực và Phân quyền (Authentication & Authorization)

- `@Public()`
- `@Roles(...roles)`
- `@RequirePermissions(...permissions)` / `@Permissions(...)`
- `@CurrentUser()` / `@CurrentUser('property')`
- `@CurrentUserId()`
- `@CurrentSessionId()`
- `@CurrentAuthorProfileId()`

Các decorator `@Public`, `@Roles` và `@RequirePermissions` chỉ dùng để ghi metadata. Các Guards phải đọc lại các key này bằng `Reflector` của NestJS.

```ts
@Get(':slug')
@Public()
findPublicStory() {}

@Post()
@Roles(RoleCode.AUTHOR, RoleCode.ADMIN)
@RequirePermissions(PermissionCode.STORY_CREATE)
createStory(
  @CurrentUserId() userId: string,
) {}
```

### Metadata của Request

- `@RequestContext()`
- `@RequestId()`
- `@CorrelationId()`
- `@ClientIp()`
- `@UserAgent()`

Các decorator này đọc giá trị được gán bởi `RequestContextInterceptor`, đi kèm với các phương án dự phòng an toàn (safe fallbacks) lấy từ properties và headers của request.

### Metadata của Interceptor

- `@SkipResponseEnvelope()`
- `@SkipRequestLogging()`
- `@SkipRequestTimeout()`
- `@RequestTimeout(milliseconds)`
- `@CacheTtl(seconds)`
- `@Idempotent(options)`

```ts
@Get('export')
@SkipResponseEnvelope()
@RequestTimeout(30_000)
exportStories() {}

@Post(':id/publish')
@Idempotent({ ttlSeconds: 86_400 })
publishStory() {}
```

`@Idempotent()` chỉ ghi nhận metadata. Nó phải đi kèm với một interceptor và một bộ lưu trữ tính trùng lập (idempotency store) đảm bảo tính nguyên tử (atomic). Không triển khai tính năng idempotency bằng `Map` lưu trong bộ nhớ (in-memory) trên các dịch vụ production mở rộng theo chiều ngang (horizontally scaled).

### Validate và Transform DTO

- `@Match('otherProperty')`
- `@IsStrongPassword()`
- `@IsNullable()`
- `@Trim()`
- `@NormalizeEmail()`
- `@EmptyStringToUndefined()`

```ts
export class RegisterRequest {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsStrongPassword()
  password!: string;

  @Match('password')
  passwordConfirmation!: string;
}
```

Để các decorator transform hoạt động, hãy bật `transform: true` trong `ValidationPipe` toàn cục. Các DTO phải là `class`, không được sử dụng `interface`.

## Quy tắc xử lý được khuyến nghị cho Guard

- `RolesGuard`: Chỉ cần thỏa mãn bất kỳ role nào được khai báo (Logical OR).
- `PermissionsGuard`: Bắt buộc phải có tất cả các quyền được khai báo (Logical AND).
- Các quy tắc về quyền sở hữu (ownership) và trạng thái (state rules) phải được xử lý ở tầng application/domain policies, không đặt trong guards.

## Lưu ý về Bảo mật

- `@ClientIp()` không thể ngăn chặn hoàn toàn việc giả mạo header `x-forwarded-for`. Hãy cấu hình trusted proxies trong Express/Fastify và tại ingress/load balancer.
- Không đưa thông tin nhạy cảm như secret, JWT hoặc mật khẩu vào metadata của decorator.
- Không gắn `@Public()` lên Controller class trừ khi tất cả các route bên trong nó đều là public.

