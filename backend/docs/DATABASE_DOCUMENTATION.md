# DATABASE DOCUMENTATION — STORY MANAGEMENT

## 1. Tổng quan

Tài liệu này mô tả database cho hệ thống quản lý truyện xây dựng bằng NestJS, Prisma ORM và PostgreSQL.

Hệ thống có bốn nhóm truy cập nghiệp vụ:

| Nhóm | Cách biểu diễn trong database |
|---|---|
| Guest | Không có bản ghi user/role; request chưa xác thực |
| User | User được gán role `USER` |
| Author | User được gán role `AUTHOR` và có một `AuthorProfile` |
| Admin | User được gán role `ADMIN` |

Thiết kế theo hướng modular monolith, nhưng dữ liệu được tách theo bounded context để sau này có thể tách notification, analytics, media processing hoặc moderation thành service riêng.

### Công nghệ và quy ước

- Database: PostgreSQL.
- ORM: Prisma ORM 7 style.
- ID chính: UUID.
- Thời gian: `TIMESTAMPTZ(3)` và lưu theo UTC.
- Tên model trong code: PascalCase, số ít.
- Tên bảng/cột trong PostgreSQL: `snake_case`, số nhiều cho bảng.
- Dữ liệu xóa nghiệp vụ dùng `deleted_at`; dữ liệu quan hệ phụ thường dùng hard delete qua cascade.
- JSON chỉ dùng cho metadata linh hoạt, không thay thế các cột cần lọc hoặc join thường xuyên.

## 2. Các file đi kèm

```text
story-management-database/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── manual-constraints.sql
├── prisma.config.ts
├── .env.example
├── package.dependencies.txt
└── DATABASE_DOCUMENTATION.md
```

- `prisma/schema.prisma`: mô hình dữ liệu chính.
- `prisma.config.ts`: URL database, đường dẫn migration và seed cho Prisma 7.
- `prisma/seed.ts`: seed role và permission hệ thống.
- `prisma/manual-constraints.sql`: CHECK constraint, partial unique index và expression index PostgreSQL mà Prisma Schema chưa biểu diễn đầy đủ.
- `.env.example`: mẫu chuỗi kết nối PostgreSQL.

## 3. Sơ đồ quan hệ mức cao

```mermaid
erDiagram
  User ||--o| AuthorProfile : "may become"
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : assigned
  Role ||--o{ RolePermission : grants
  Permission ||--o{ RolePermission : included

  AuthorProfile ||--o{ Story : owns
  Story ||--o{ Chapter : contains
  Chapter ||--o{ ChapterVersion : snapshots
  Story ||--o{ StoryCategory : classified
  Category ||--o{ StoryCategory : contains
  Story ||--o{ StoryTag : tagged
  Tag ||--o{ StoryTag : contains

  User ||--o{ LibraryEntry : saves
  Story ||--o{ LibraryEntry : saved
  User ||--o{ StoryFollow : follows
  Story ||--o{ StoryFollow : followed
  User ||--o{ Rating : rates
  Story ||--o{ Rating : rated
  User ||--o{ Comment : writes
  Story ||--o{ Comment : receives
  Chapter ||--o{ Comment : optionally_receives

  User ||--o{ ReadingProgress : tracks
  Story ||--o{ ReadingProgress : progress
  User ||--o{ ReadingSession : reads
  Chapter ||--o{ ReadingSession : session

  Story ||--o{ StorySubmission : submitted
  User ||--o{ Report : files
  User ||--o{ ModerationAction : performs
  User ||--o{ Notification : receives
  User ||--o{ AuditLog : acts
```

## 4. Các domain dữ liệu

### 4.1 Identity và authentication

#### `users`

Bảng tài khoản trung tâm cho User, Author và Admin.

Trường quan trọng:

| Cột | Ý nghĩa |
|---|---|
| `id` | UUID của user |
| `email` | Email đăng nhập; phải normalize lowercase ở application layer |
| `username` | Tên định danh công khai |
| `password_hash` | Hash mật khẩu; nullable để hỗ trợ OAuth-only account |
| `display_name` | Tên hiển thị |
| `status` | `active`, `suspended`, `banned`, `deleted` |
| `email_verified_at` | Thời điểm xác thực email |
| `avatar_media_id` | Ảnh đại diện trong `media_assets` |
| `deleted_at` | Soft delete account |

Không được lưu access token, refresh token hoặc mật khẩu dạng rõ.

#### `oauth_accounts`

Liên kết tài khoản với Google, Facebook hoặc GitHub. Cặp `(provider, provider_account_id)` là duy nhất.

Nếu lưu access/refresh token của nhà cung cấp, production phải mã hóa ở application hoặc secret service trước khi ghi database.

#### `sessions`

Mỗi thiết bị hoặc phiên đăng nhập có một session riêng.

- Chỉ lưu `refresh_token_hash`, không lưu refresh token gốc.
- `revoked_at` dùng cho logout/revoke.
- `expires_at` cho phép cron/job dọn dữ liệu hết hạn.
- Có thể revoke toàn bộ session khi đổi mật khẩu hoặc phát hiện compromise.

#### `user_tokens`

Token một lần cho:

- xác thực email;
- reset mật khẩu;
- đổi email.

Chỉ lưu hash của token. `consumed_at` đảm bảo token không được sử dụng lại.

### 4.2 Authorization — RBAC + Permission

#### `roles`

Seed ba role hệ thống:

| Code | Ý nghĩa |
|---|---|
| `USER` | Người đọc đã đăng nhập |
| `AUTHOR` | Tác giả, đồng thời có quyền reader |
| `ADMIN` | Quản trị viên |

`Guest` không phải role trong database.

#### `permissions`

Permission có dạng `resource.action`, ví dụ:

```text
story.read
story.create
story.update.own
story.review
story.publish
comment.moderate
user.manage
audit-log.read
```

Các cột `resource` và `action` giúp lọc hoặc tạo giao diện quản trị permission.

#### `user_roles`

Bảng nối user-role tường minh, lưu thêm:

- người gán role (`assigned_by_id`);
- thời điểm gán;
- thời điểm hết hạn nếu role tạm thời.

Một Author thường có cả role `USER` và `AUTHOR`, hoặc application có thể coi permission của `AUTHOR` đã bao gồm permission reader như seed hiện tại.

#### `role_permissions`

Bảng nối role-permission. Dùng composite primary key để tránh trùng quyền.

> Guard chỉ xác nhận permission tổng quát. Quyền sở hữu như “đây có phải truyện của tác giả này không?” phải được kiểm tra trong policy/use case.

### 4.3 Author và media

#### `author_profiles`

Mở rộng một `users` thành hồ sơ tác giả.

- Quan hệ 1–1 qua `user_id`.
- `pen_name` là duy nhất.
- `verification_status` hỗ trợ quy trình xác minh tác giả.
- `social_links` là JSON vì cấu trúc liên kết có thể thay đổi.

Không tạo một bảng login riêng cho Author.

#### `media_assets`

Lưu metadata file, không lưu binary trong PostgreSQL.

| Cột | Ý nghĩa |
|---|---|
| `storage_provider` | S3, MinIO, GCS... |
| `bucket` | Bucket/container |
| `storage_key` | Khóa object duy nhất |
| `public_url` | URL công khai hoặc CDN URL, nullable |
| `mime_type` | Kiểu MIME |
| `size_bytes` | Kích thước file |
| `checksum_sha256` | Kiểm tra trùng file/toàn vẹn |
| `status` | pending, ready, failed, deleted |
| `purpose` | avatar, banner, cover, chapter image, attachment |

Upload nên theo flow:

1. Tạo `media_assets` trạng thái `pending`.
2. Client upload bằng presigned URL.
3. Worker xác thực MIME/checksum, resize hoặc scan.
4. Chuyển trạng thái sang `ready`.
5. Gắn asset vào user/story.

### 4.4 Story catalog

#### `stories`

Aggregate root chính của nội dung truyện.

Trạng thái:

```text
DRAFT -> PENDING_REVIEW -> PUBLISHED
                    \-> REJECTED -> DRAFT
PUBLISHED -> SUSPENDED -> PUBLISHED
PUBLISHED -> COMPLETED
* -> ARCHIVED
```

Các trường count như `view_count`, `follower_count`, `rating_count`, `chapter_count` là dữ liệu denormalized để đọc nhanh. Chúng phải được cập nhật bằng transaction, atomic increment hoặc worker tổng hợp; không coi là nguồn dữ liệu duy nhất khi cần đối soát.

`version` dùng cho optimistic concurrency control:

```ts
await prisma.story.updateMany({
  where: { id: storyId, version: expectedVersion },
  data: {
    title: newTitle,
    version: { increment: 1 },
  },
});
```

Nếu số bản ghi update bằng 0, dữ liệu đã bị thay đổi bởi request khác.

#### `story_contributors`

Hỗ trợ cộng tác viên ngoài chủ sở hữu:

- co-author;
- editor;
- translator;
- illustrator.

`can_edit` chỉ là tín hiệu dữ liệu. Application vẫn phải kiểm tra permission và phạm vi thao tác.

#### `categories`, `story_categories`

Category có cấu trúc cây qua `parent_id`.

`story_categories` là bảng nối tường minh để lưu `is_primary`. File `manual-constraints.sql` đảm bảo mỗi truyện chỉ có tối đa một category chính.

#### `tags`, `story_tags`

Tag là nhãn linh hoạt. Dùng bảng nối explicit để có tên bảng/index rõ ràng và dễ mở rộng metadata sau này.

### 4.5 Chapters và version history

#### `chapters`

Mỗi chapter thuộc một story.

- `(story_id, number)` duy nhất.
- `(story_id, slug)` duy nhất.
- `number` là Decimal để hỗ trợ chương `10.5` hoặc ngoại truyện nằm giữa chương.
- `scheduled_at` phục vụ publish theo lịch.
- `version` hỗ trợ optimistic locking.
- `created_by_id` và `updated_by_id` lưu người thao tác.

Trạng thái:

```text
DRAFT -> SCHEDULED -> PUBLISHED
PUBLISHED -> HIDDEN -> PUBLISHED
* -> ARCHIVED
```

#### `chapter_versions`

Lưu snapshot bất biến của chapter trước hoặc sau mỗi lần chỉnh sửa quan trọng.

Quy trình update khuyến nghị trong một transaction:

1. Đọc chapter với version hiện tại.
2. Ghi snapshot vào `chapter_versions`.
3. Update `chapters` với điều kiện version cũ.
4. Tăng version.
5. Tạo outbox event nếu cần index/search/cache invalidation.

Không sửa hoặc xóa snapshot lịch sử trừ chính sách retention rõ ràng.

### 4.6 Reader engagement

#### `library_entries`

Một user có đúng một library entry cho mỗi story.

Trạng thái: plan-to-read, reading, completed, on-hold, dropped.

`last_read_chapter_id` và `progress_percent` phục vụ hiển thị nhanh. Nguồn tiến độ chi tiết là `reading_progress`.

#### `story_follows`

Theo dõi truyện và lựa chọn bật/tắt thông báo chương mới. Số follower trong `stories.follower_count` là counter denormalized.

#### `ratings`

Một user chỉ đánh giá một lần cho mỗi story; update trên cùng record nếu đổi điểm.

- `score` phải từ 1 đến 5.
- Review text có moderation status.
- Khi rating thay đổi hoặc bị xóa, cập nhật `rating_count` và `rating_average` trong transaction hoặc job đối soát.

#### `comments`, `comment_reactions`

`comments` hỗ trợ:

- comment cấp story khi `chapter_id` null;
- comment cấp chapter khi `chapter_id` có giá trị;
- thread reply qua `parent_id`;
- soft delete và moderation;
- counter `like_count`, `reply_count` để đọc nhanh.

`comment_reactions` dùng composite key `(comment_id, user_id)`, nên một user chỉ có một reaction hiện hành trên comment.

Application phải xác nhận:

- chapter thuộc đúng story trong comment;
- parent comment thuộc cùng story/chapter;
- user có quyền comment và không bị ban.

#### `reading_progress`

Snapshot tiến độ hiện tại của user trên một story. Composite primary key `(user_id, story_id)` cho phép upsert hiệu quả.

#### `reading_sessions`

Event đọc phục vụ lịch sử và analytics:

- chapter được đọc;
- thời gian bắt đầu/kết thúc;
- vị trí đầu/cuối;
- thời lượng;
- đã hoàn tất chương hay chưa.

Bảng này có thể tăng rất nhanh. Khi quy mô lớn:

- partition theo tháng trên `started_at`;
- retention dữ liệu raw 3–12 tháng;
- tổng hợp sang daily stats;
- chuyển raw analytics sang ClickHouse/BigQuery nếu cần.

### 4.7 Submission và moderation

#### `story_submissions`

Lưu lịch sử mỗi lần tác giả gửi truyện duyệt. Không dùng riêng `stories.status` vì cần biết:

- ai submit;
- khi nào submit;
- ai review;
- lý do approve/reject;
- lịch sử nhiều vòng duyệt.

Partial unique index trong `manual-constraints.sql` đảm bảo một story chỉ có một submission `pending`.

#### `reports`

Một report trỏ đúng một loại target:

- story;
- chapter;
- comment;
- user.

Prisma không mô tả tốt polymorphic foreign key, nên schema dùng các FK nullable kết hợp `target_type`. CHECK constraint PostgreSQL đảm bảo chỉ đúng một target được điền và target đó khớp loại.

#### `moderation_actions`

Audit nghiệp vụ cho hành động kiểm duyệt, ví dụ:

- approve/reject/suspend story;
- hide chapter/comment;
- suspend/ban/restore user.

Bảng này không thay thế `audit_logs`; nó là lịch sử nghiệp vụ có cấu trúc để admin xem và đối soát.

### 4.8 Notification, audit và reliable events

#### `notifications`

Thông báo in-app cho từng user.

`type` để String thay vì enum vì loại notification thường được mở rộng nhanh. Mỗi loại cần có payload contract rõ ràng trong application code.

#### `notification_preferences`

Quan hệ 1–1 với user, lưu lựa chọn email/push/in-app và các event phổ biến.

#### `audit_logs`

Lưu hành động bảo mật và quản trị:

- actor;
- action;
- loại/id entity;
- giá trị trước/sau;
- IP, user-agent, request ID.

Audit log nên append-only. Không cho API thông thường update/delete record.

Không ghi các dữ liệu bí mật như password, token gốc, cookie hoặc authorization header vào JSON audit.

#### `outbox_events`

Áp dụng Transactional Outbox Pattern.

Trong cùng transaction thay đổi domain:

1. Update dữ liệu nghiệp vụ.
2. Insert một `outbox_events` trạng thái pending.
3. Commit.
4. Worker đọc event pending, publish tới queue/event bus.
5. Đánh dấu published hoặc retry.

Nhờ vậy không xảy ra trường hợp database commit nhưng message bị mất.

### 4.9 Aggregated analytics

#### `story_daily_stats`, `chapter_daily_stats`

Lưu số liệu tổng hợp theo ngày để:

- dashboard tác giả;
- bảng xếp hạng;
- báo cáo admin;
- tránh scan `reading_sessions` liên tục.

Các bảng daily stats không phải nguồn sự thật duy nhất. Cần job rebuild hoặc reconciliation để sửa sai lệch.

## 5. Chiến lược index

Schema đã tạo index theo các nhóm truy vấn chính:

### Public catalog

```text
stories(status, visibility, published_at)
stories(last_chapter_at)
stories(content_rating, status)
chapters(story_id, status, published_at)
```

### Author dashboard

```text
stories(author_id, status, updated_at)
chapters(scheduled_at, status)
story_submissions(story_id, status, submitted_at)
```

### Reader

```text
library_entries(user_id, status, updated_at)
reading_progress(user_id, last_read_at)
notifications(user_id, read_at, created_at)
```

### Moderation

```text
reports(status, created_at)
reports(assigned_to_id, status)
moderation_actions(actor_id, created_at)
audit_logs(entity_type, entity_id, created_at)
```

### Quy tắc bổ sung

- Index foreign key được dùng để filter/join thường xuyên.
- Không tạo index mọi cột; mỗi index làm chậm write và tốn storage.
- Kiểm tra query thực tế bằng `EXPLAIN (ANALYZE, BUFFERS)` trước khi thêm composite index mới.
- Thứ tự cột composite index phải phù hợp điều kiện equality trước, range/order sau.

## 6. Ràng buộc không nằm hoàn toàn trong Prisma Schema

File `prisma/manual-constraints.sql` bổ sung:

1. Unique không phân biệt hoa thường cho email, username, pen name và slug.
2. Rating từ 1 đến 5.
3. Progress từ 0 đến 100.
4. Chapter number dương.
5. Report có đúng một target phù hợp `target_type`.
6. Moderation action có đúng một target.
7. Một primary category cho mỗi story.
8. Một pending submission cho mỗi story.
9. Chặn report mở trùng target của cùng reporter.

Các quy tắc liên bảng sau phải kiểm tra trong transaction/application hoặc trigger riêng:

- chapter của comment thuộc cùng story;
- chapter hiện tại của reading progress thuộc cùng story;
- last-read chapter trong library thuộc cùng story;
- chapter của reading session thuộc cùng story;
- author đang update thực sự là owner hoặc contributor có quyền;
- reviewer không tự duyệt submission của mình nếu chính sách yêu cầu tách nhiệm vụ.

## 7. Delete policy

### Soft delete

Dùng cho entity cần khôi phục hoặc audit:

- users;
- stories;
- chapters;
- comments;
- ratings;
- media assets.

Mọi query thông thường phải thêm `deletedAt: null`. Nên bọc trong repository để tránh quên.

### Hard delete/cascade

Dùng cho dữ liệu phụ thuộc không còn ý nghĩa độc lập:

- session, token khi xóa user vật lý;
- bảng nối role/category/tag;
- chapter version khi chapter bị hard delete;
- library/follow/progress khi user hoặc story bị hard delete.

Production không nên hard delete user/story trực tiếp qua API. Dùng scheduled purge sau retention period và kiểm tra yêu cầu pháp lý.

## 8. Transaction boundaries

Các use case sau phải chạy trong transaction:

### Publish story

```text
lock/check story version
approve submission
update story status + published_at
insert moderation action
insert outbox event
commit
```

### Publish chapter

```text
check owner/permission
snapshot chapter version
update chapter status + published_at
increment story.chapter_count / last_chapter_at
insert outbox event for notification/search/cache
commit
```

### Rate story

```text
upsert rating
recalculate or atomically update aggregate
update story.rating_count/rating_average
commit
```

### Follow/unfollow

```text
insert/delete story_follow
atomic increment/decrement story.follower_count
commit
```

Counter decrement phải dùng `max(0, value - 1)` hoặc reconciliation job để tránh số âm do retry/race condition.

## 9. Seed role và permission

`prisma/seed.ts` tạo ba role system và permission mặc định.

Seed phải idempotent: chạy nhiều lần không tạo record trùng.

Permission của `AUTHOR` hiện bao gồm permission reader. `ADMIN` nhận toàn bộ permission được khai báo.

Trong môi trường production:

- không tự cấp role ADMIN cho user mẫu;
- tài khoản admin đầu tiên nên được tạo bằng secure bootstrap command;
- ghi audit khi gán hoặc thu hồi role;
- invalidation cache permission ngay sau thay đổi RBAC.

## 10. Cài đặt và chạy

### 10.1 Cài dependency

```bash
npm install @prisma/client @prisma/adapter-pg pg dotenv
npm install --save-dev prisma tsx @types/pg
```

### 10.2 Tạo biến môi trường

```bash
cp .env.example .env
```

Ví dụ:

```env
DATABASE_URL="postgresql://story_app:change_me@localhost:5432/story_management?schema=public"
```

### 10.3 Format và validate

```bash
npx prisma format
npx prisma validate
```

### 10.4 Tạo migration đầu tiên

```bash
npx prisma migrate dev --name init_story_management
```

Sau khi Prisma tạo `migration.sql`, chèn nội dung từ `prisma/manual-constraints.sql` vào cuối migration đầu tiên trước khi áp dụng trên các môi trường khác.

Không chạy `manual-constraints.sql` như script lặp lại vì tên constraint/index sẽ tồn tại từ lần đầu.

### 10.5 Generate client

```bash
npx prisma generate
```

Client được sinh tại:

```text
src/generated/prisma
```

### 10.6 Seed

```bash
npx prisma db seed
```

### 10.7 Production deployment

```bash
npx prisma migrate deploy
npx prisma generate
```

Không dùng `prisma migrate dev` hoặc `db push` trong production.

## 11. PrismaService cho NestJS và Prisma 7

Prisma 7 yêu cầu driver adapter. Ví dụ PostgreSQL:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Trong production nên truyền config qua `ConfigService`, không đọc `process.env` rải rác ngoài bootstrap/infrastructure config.

## 12. Query patterns mẫu

### Lấy truyện public

```ts
const story = await prisma.story.findFirst({
  where: {
    slug,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    deletedAt: null,
  },
  select: {
    id: true,
    title: true,
    synopsis: true,
    ratingAverage: true,
    author: {
      select: {
        penName: true,
      },
    },
    coverMedia: {
      select: {
        publicUrl: true,
      },
    },
  },
});
```

### Kiểm tra permission

```ts
const permissions = await prisma.permission.findMany({
  where: {
    roles: {
      some: {
        role: {
          userRoles: {
            some: {
              userId,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
              ],
            },
          },
        },
      },
    },
  },
  select: { code: true },
});
```

Trong request path có traffic cao, cache permission theo user/role version thay vì query đầy đủ mỗi request.

### Upsert reading progress

```ts
await prisma.readingProgress.upsert({
  where: {
    userId_storyId: { userId, storyId },
  },
  update: {
    currentChapterId: chapterId,
    position,
    progressPercent,
    lastReadAt: new Date(),
  },
  create: {
    userId,
    storyId,
    currentChapterId: chapterId,
    position,
    progressPercent,
  },
});
```

## 13. Cache và consistency

Dữ liệu phù hợp cache Redis:

- story detail public;
- danh sách chapter public;
- category/tag;
- homepage ranking;
- permission set của user;
- author public profile.

Cache invalidation nên phát từ outbox event:

```text
story.updated
story.published
chapter.published
rating.changed
story.follow-count.changed
role-permission.changed
```

Không cache dữ liệu nhạy cảm hoặc session object lâu hơn TTL bảo mật cho phép.

## 14. Security checklist

- Hash password bằng Argon2id hoặc bcrypt với cost phù hợp.
- Hash refresh token và one-time token trước khi lưu.
- Encrypt OAuth token nếu bắt buộc lưu.
- Normalize email/username/slug trước khi insert.
- Không trả `password_hash`, token hash, OAuth token trong DTO.
- Audit thay đổi role, ban user, publish/suspend story.
- Rate-limit login, reset password, comment và report.
- Dùng transaction cho ownership check + update để tránh TOCTOU.
- Không tin counter gửi từ client.
- Không dùng dữ liệu JSON làm authorization source.

## 15. Backup, retention và vận hành

### Backup

- Daily full backup hoặc snapshot.
- Point-in-time recovery bằng WAL cho production quan trọng.
- Thử restore định kỳ; backup chưa test restore không được coi là an toàn.

### Retention đề xuất

| Dữ liệu | Retention gợi ý |
|---|---|
| Session/token hết hạn | 7–30 ngày sau hết hạn |
| Notification đã đọc | 90–180 ngày |
| Raw reading sessions | 3–12 tháng |
| Audit logs | 1–7 năm tùy chính sách |
| Chapter versions | Giữ lâu dài hoặc theo policy tác giả |
| Outbox published | 7–30 ngày sau publish |

### Jobs định kỳ

- Revoke/xóa session hết hạn.
- Xóa token đã dùng hoặc hết hạn.
- Retry outbox event lỗi.
- Rebuild story counters.
- Aggregate daily stats.
- Purge soft-deleted entity sau retention.
- Xóa media orphan sau grace period.

## 16. Partitioning và scale

Chưa cần partition ngay khi dự án nhỏ. Các bảng có khả năng tăng nhanh nhất:

1. `reading_sessions`;
2. `audit_logs`;
3. `notifications`;
4. `outbox_events`;
5. `story_daily_stats` và `chapter_daily_stats` theo thời gian dài.

Khi bảng đạt hàng chục/hàng trăm triệu record, cân nhắc range partition theo tháng trên timestamp/date. Prisma có thể query partitioned table như bảng bình thường, nhưng DDL partition thường phải viết bằng migration SQL thủ công.

## 17. Những quyết định cố ý không đưa vào schema

### Payment/payout

Chưa thêm bảng thanh toán, subscription, coin hoặc payout vì chưa có yêu cầu monetization. Domain tài chính cần thiết kế riêng với ledger bất biến, Decimal currency, idempotency và reconciliation.

### Full-text search

PostgreSQL full-text search hoặc Elasticsearch/OpenSearch không được hard-code trong schema hiện tại. Với quy mô nhỏ có thể thêm `tsvector` bằng migration SQL; quy mô lớn dùng search adapter và outbox event.

### Raw story view event

Không lưu mỗi lượt xem vào PostgreSQL chính để tránh write amplification. Sử dụng Redis/Kafka/analytics store rồi tổng hợp về `story_daily_stats`.

### Guest analytics

Guest không có user ID. Nếu cần đo unique visitor, dùng anonymous session ID đã hash và tuân thủ privacy policy trong analytics subsystem, không biến Guest thành role database.

## 18. Checklist trước khi merge migration

- [ ] `npx prisma format` thành công.
- [ ] `npx prisma validate` thành công.
- [ ] Migration được review như source code.
- [ ] `manual-constraints.sql` đã được chèn đúng vào migration đầu tiên.
- [ ] Không có migration drop column/table ngoài dự kiến.
- [ ] Có kế hoạch backfill cho cột required mới.
- [ ] Query quan trọng có index phù hợp.
- [ ] Seed chạy idempotent.
- [ ] E2E test role USER/AUTHOR/ADMIN và guest.
- [ ] Test ownership policy cho story/chapter/comment.
- [ ] Test rollback ở môi trường staging bằng restore hoặc forward-fix plan.

## 19. Kết luận

Schema này ưu tiên:

- tách rõ identity, RBAC, catalog, reader engagement, moderation và operations;
- giữ lịch sử thay đổi quan trọng;
- hỗ trợ soft delete và audit;
- dùng explicit join table khi cần metadata hoặc kiểm soát index;
- chuẩn bị sẵn outbox và daily aggregate cho scale;
- không coi Guest là một role;
- không phụ thuộc vào controller hoặc cấu trúc HTTP.

Đây là baseline enterprise cho modular monolith. Trước khi production, cần chạy validate bằng phiên bản Prisma thực tế của dự án, review migration SQL và benchmark theo query thật.
