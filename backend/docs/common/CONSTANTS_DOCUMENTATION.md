# Common Constants Documentation

## Mục tiêu

`src/common/constants` chỉ chứa các hằng số kỹ thuật ổn định được sử dụng bởi nhiều module. Không đưa secret, URL môi trường, thời gian sống token theo deployment, hoặc quy tắc nghiệp vụ riêng của Story/Chapter/User vào đây.

## Cấu trúc

```text
src/common/constants/
├── application.constants.ts
├── auth.constants.ts
├── cache.constants.ts
├── error.constants.ts
├── http.constants.ts
├── injection-tokens.constants.ts
├── interceptor.constants.ts
├── metadata.constants.ts
├── pagination.constants.ts
├── queue.constants.ts
├── regex.constants.ts
├── security.constants.ts
├── time.constants.ts
├── upload.constants.ts
└── index.ts
```

## Quy tắc phân loại

Đặt trong `common/constants` khi giá trị:

1. Được dùng bởi ít nhất hai module độc lập.
2. Là chi tiết kỹ thuật, không phải business rule.
3. Không thay đổi theo từng deployment.
4. Không chứa secret hoặc credential.

Không đặt trong đây:

```text
DATABASE_URL
JWT_SECRET
REDIS_URL
S3_SECRET_KEY
PUBLIC_APP_URL
STORY_TITLE_MAX_LENGTH
CHAPTER_MIN_WORD_COUNT
STORY_PUBLISH_REWARD
```

Các giá trị môi trường dùng `ConfigService`. Business constant đặt trong module sở hữu, ví dụ:

```text
src/modules/stories/domain/constants/story.constants.ts
src/modules/chapters/domain/constants/chapter.constants.ts
src/modules/auth/constants/password-policy.constants.ts
```

## Injection tokens

TypeScript interface không tồn tại ở runtime. Khi inject một port/interface bằng NestJS, dùng token được export duy nhất:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK } from '@/common/constants';
import type { ClockPort } from '@/common/ports';

@Injectable()
export class CreateStoryHandler {
  constructor(
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}
}
```

Provider:

```ts
{
  provide: CLOCK,
  useClass: SystemClock,
}
```

Không tạo lại `Symbol('CLOCK')` tại nơi inject vì đó là symbol khác.

## Metadata keys

Decorator ghi metadata:

```ts
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '@/common/constants';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Guard đọc metadata:

```ts
const isPublic = this.reflector.getAllAndOverride<boolean>(
  IS_PUBLIC_KEY,
  [context.getHandler(), context.getClass()],
);
```

## Tích hợp với bộ interceptors đã tạo

Hai file cũ có thể đổi thành compatibility re-export để tránh duplicate source of truth.

`src/common/interceptors/common-interceptors.constants.ts`:

```ts
export {
  COMMON_HTTP_TIMEOUT_MS,
  DEFAULT_HTTP_TIMEOUT_MS,
} from '../constants';
```

`src/common/interceptors/interceptor-metadata.constants.ts`:

```ts
export {
  REQUEST_TIMEOUT_MS_KEY,
  SKIP_REQUEST_LOGGING_KEY,
  SKIP_REQUEST_TIMEOUT_KEY,
  SKIP_RESPONSE_ENVELOPE_KEY,
} from '../constants';
```

Sau khi toàn bộ import đã chuyển sang `@/common/constants`, có thể xóa hai file compatibility trên.

## Pagination

```ts
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';
```

Các giá trị này là mặc định transport. Query DTO vẫn phải validate `page` và `limit`.

## Cache

```ts
const key = joinCacheKey(
  'story',
  CACHE_SCHEMA_VERSION,
  storyId,
);
```

Prefix cụ thể như `stories:detail` hoặc `users:permissions` nên được module sở hữu định nghĩa, tránh để common phụ thuộc business vocabulary.

## Upload

`IMAGE_MIME_TYPES` chỉ là allowlist mặc định. Việc kiểm tra magic bytes/signature và xử lý ảnh vẫn phải diễn ra ở media/storage layer; không chỉ tin vào MIME type do client gửi.

## Kiểm tra TypeScript

```bash
npx tsc -p tsconfig.json
```

Bộ source đi kèm đã được kiểm tra với `strict`, `exactOptionalPropertyTypes` và `noUncheckedIndexedAccess`.
