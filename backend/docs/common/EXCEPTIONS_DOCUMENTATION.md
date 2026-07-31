# COMMON EXCEPTIONS

Folder này chứa các exception kỹ thuật dùng chung giữa nhiều module. Tất cả exception đều thuần TypeScript và không phụ thuộc NestJS, HTTP, Prisma, Express hay Fastify.

## Nguyên tắc

- `common/exceptions` chỉ chứa lỗi dùng chung.
- Lỗi nghiệp vụ như `StoryNotFoundException` đặt trong `modules/stories/domain/exceptions` và kế thừa exception tại đây.
- Không throw `HttpException` trong domain/application.
- `cause` chỉ phục vụ log, tuyệt đối không trả trực tiếp cho client.
- `code` là mã ổn định để frontend và log/monitoring sử dụng.
- `ExceptionCategory` được HTTP filter ánh xạ sang status code.

## Nhóm exception

### Base và metadata

- `AppException`: base class của toàn bộ exception.
- `ExceptionCategory`: phân loại transport-agnostic.
- `CommonExceptionCode`: mã lỗi thuộc common layer.
- `ValidationIssue`: cấu trúc một lỗi validation.

### Input và validation

- `InvalidInputException`
- `ValidationException`
- `PayloadTooLargeException`
- `UnsupportedMediaTypeException`

### Authentication và authorization

- `AuthenticationRequiredException`
- `InvalidCredentialsException`
- `InvalidTokenException`
- `TokenExpiredException`
- `AccessDeniedException`
- `MissingPermissionException`

### Resource và conflict

- `ResourceNotFoundException`
- `ResourceGoneException`
- `ResourceConflictException`
- `ResourceAlreadyExistsException`
- `ConcurrencyConflictException`
- `OptimisticLockException`
- `IdempotencyConflictException`

### Business/state

- `BusinessRuleViolationException`
- `InvalidOperationException`
- `InvalidStateTransitionException`
- `PreconditionFailedException`

### Request/system

- `RateLimitExceededException`
- `RequestTimeoutException`
- `ServiceUnavailableException`
- `ExternalServiceException`

### Infrastructure

- `InfrastructureException`
- `DatabaseException`
- `StorageException`
- `CacheException`
- `QueueException`
- `ConfigurationException`
- `SerializationException`
- `UnexpectedException`

## Ví dụ trong module stories

```ts
import { ResourceNotFoundException } from '@/common/exceptions';

export class StoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId: string) {
    super({
      code: 'STORY_NOT_FOUND',
      message: 'Không tìm thấy truyện',
      resource: 'Story',
      identifier: storyId,
    });
  }
}
```

```ts
import { InvalidStateTransitionException } from '@/common/exceptions';

throw new InvalidStateTransitionException({
  code: 'STORY_STATUS_TRANSITION_INVALID',
  message: 'Không thể chuyển truyện sang trạng thái yêu cầu',
  resource: 'Story',
  identifier: story.id,
  fromState: story.status,
  toState: nextStatus,
});
```

## Import

```ts
import {
  AccessDeniedException,
  BusinessRuleViolationException,
  DatabaseException,
  ResourceNotFoundException,
  ValidationException,
} from '@/common/exceptions';
```

## HTTP mapping đề xuất

| Category | HTTP status |
|---|---:|
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `GONE` | 410 |
| `CONFLICT` | 409 |
| `PRECONDITION_FAILED` | 412 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `UNPROCESSABLE_ENTITY` | 422 |
| `TOO_MANY_REQUESTS` | 429 |
| `REQUEST_TIMEOUT` | 408 |
| `BAD_GATEWAY` | 502 |
| `SERVICE_UNAVAILABLE` | 503 |
| `INTERNAL` | 500 |
