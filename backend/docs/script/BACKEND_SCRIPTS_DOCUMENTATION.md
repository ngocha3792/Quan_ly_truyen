# Backend Scripts Architecture

> Dự án: **Quản lý truyện — NestJS + Prisma + PostgreSQL**  
> Phạm vi: `backend/scripts`, các lệnh tương ứng trong `backend/package.json`, và cách các script tương tác với `prisma/`, `src/` và môi trường triển khai.

## Isolated media maintenance contexts

The commands below use dedicated Nest application-context modules and do not
bootstrap `WorkerModule`:

```bash
npm run maintenance:media-cleanup
npm run maintenance:cloudinary-webhooks
```

`maintenance:media-cleanup` resolves only the media cleanup workflow and its
database/config/storage dependencies. `maintenance:cloudinary-webhooks` runs a
single inbox batch. Neither command registers the outbox repeatable job,
instantiates the mail processor, verifies SMTP, or starts a webhook polling
timer. Long-running polling remains the responsibility of `start:worker:*`
with `WORKER_ROLE=all` or `WORKER_ROLE=cloudinary-webhook`.

---

## 1. Mục đích của tài liệu

Tài liệu này giúp thành viên dự án hiểu:

- `backend/scripts` dùng để làm gì.
- Loại tác vụ nào nên hoặc không nên đặt trong folder này.
- Cấu trúc folder phù hợp với dự án Quản lý truyện.
- Những script nào cần triển khai trước.
- Quy tắc an toàn khi script thay đổi dữ liệu.
- Cách phân biệt script vận hành với migration, seed, cron job và code nghiệp vụ.
- Cách đặt tên, truyền tham số, log, trả exit code và kiểm thử script.
- Cách tránh biến `scripts/` thành nơi chứa code tạm hoặc logic nghiệp vụ bị sao chép.

Đây là tài liệu kiến trúc. Hướng dẫn triển khai từng bước và code mẫu nằm trong tài liệu:

```text
BACKEND_SCRIPTS_IMPLEMENTATION_GUIDE.md
```

---

## 2. Trạng thái hiện tại

Tại thời điểm viết tài liệu, backend chưa có folder:

```text
backend/scripts/
```

Các tác vụ hỗ trợ hiện đang nằm chủ yếu trong `package.json` và `prisma/`:

```json
{
  "postinstall": "prisma generate --config prisma.config.ts",
  "db:seed": "prisma migrate reset --config prisma.config.ts --skip-seed; tsx prisma/seed.ts",
  "db:migrate": "prisma migrate dev --config prisma.config.ts",
  "db:migrate:deploy": "prisma migrate deploy --config prisma.config.ts"
}
```

Ngoài ra dự án có:

```text
backend/prisma/schema.prisma
backend/prisma/seed.ts
backend/prisma/manual-constraints.sql
backend/prisma/migrations/
backend/docker-compose.yml
```

### Vấn đề cần sửa ngay

Lệnh hiện tại:

```json
"db:seed": "prisma migrate reset --config prisma.config.ts --skip-seed; tsx prisma/seed.ts"
```

dùng dấu `;`. Trên shell, lệnh phía sau vẫn có thể chạy dù lệnh reset phía trước thất bại.

Điều này có thể tạo trạng thái khó đoán:

1. Migration reset thất bại.
2. `seed.ts` vẫn chạy trên database cũ hoặc database sai.
3. Roles và permissions được cập nhật trong một schema chưa đúng phiên bản.

Cần tách hai khái niệm:

```text
db:seed        = chỉ seed dữ liệu hệ thống, không xóa database
db:reset:local = reset database local rồi mới seed
```

Nếu ghép command trực tiếp thì phải dùng `&&`, không dùng `;`. Tuy nhiên phương án tốt hơn là triển khai một script TypeScript có kiểm tra môi trường.

---

## 3. `backend/scripts` là gì?

`backend/scripts` chứa các **command-line task phục vụ phát triển, CI/CD, vận hành, bảo trì và sửa dữ liệu có kiểm soát**.

Một script thường:

- Chạy một lần rồi kết thúc.
- Không mở HTTP server.
- Có đầu vào rõ ràng.
- Log tiến trình và kết quả.
- Trả exit code phù hợp.
- Có thể chạy từ local, CI hoặc môi trường vận hành.
- Dùng lại hạ tầng của dự án nhưng không được sao chép nghiệp vụ tùy tiện.

Ví dụ phù hợp:

- Kiểm tra biến môi trường bắt buộc.
- Kiểm tra kết nối PostgreSQL.
- Chờ PostgreSQL sẵn sàng trong CI.
- Reset database local.
- Xác minh manual indexes và constraints.
- Tạo tài khoản admin ban đầu.
- Dọn session và token hết hạn.
- Đối soát hoặc tái tính `chapterCount`, `ratingCount`, `ratingAverage`, `commentCount`.
- Backfill dữ liệu sau một thay đổi schema.
- Kiểm tra dữ liệu trước hoặc sau deployment.

---

## 4. Những gì không thuộc `backend/scripts`

### 4.1. Prisma migration

Thay đổi schema và database contract phải nằm trong:

```text
backend/prisma/migrations/
```

Không tạo script như:

```text
scripts/database/add-user-column.ts
scripts/database/create-story-index.ts
```

nếu thay đổi đó cần được áp dụng đồng nhất cho mọi môi trường.

Migration phải là nguồn lịch sử duy nhất của schema.

---

### 4.2. Prisma seed

Dữ liệu nền tảng cần tồn tại ở mọi môi trường phù hợp vẫn nằm trong:

```text
backend/prisma/seed.ts
```

Trong dự án hiện tại, seed tạo:

- Permissions.
- Role `USER`.
- Role `AUTHOR`.
- Role `ADMIN`.
- Mapping role–permission.

Không chuyển logic này sang `scripts/development/create-demo-data.ts`.

`prisma/seed.ts` phải idempotent và có thể chạy nhiều lần.

---

### 4.3. Nghiệp vụ runtime

Các chức năng như:

- Publish chapter theo lịch.
- Gửi notification.
- Xử lý outbox event.
- Duyệt truyện.
- Khóa tài khoản.
- Tính analytics hằng ngày.

không nên tồn tại duy nhất dưới dạng script nếu chúng là nghiệp vụ chạy thường xuyên.

Chúng phải được triển khai trong module/service/use case của `src/`. Script hoặc scheduled job chỉ gọi use case đó.

---

### 4.4. File shell tạm thời

Không commit các file như:

```text
fix-now.sh
temp-data.ts
run-this-on-prod.ts
test2.ts
```

Mọi script được commit phải có:

- Tên mô tả rõ.
- Owner hoặc phạm vi rõ.
- Chốt chặn an toàn.
- Hướng dẫn chạy.
- Tiêu chí thành công.
- Kế hoạch xóa nếu chỉ phục vụ migration dữ liệu một lần.

---

## 5. Phân biệt các khái niệm liên quan

| Thành phần             | Mục đích                       | Ví dụ                             |
| ---------------------- | ------------------------------ | --------------------------------- |
| `package.json` scripts | Alias ngắn để gọi command      | `npm run db:verify`               |
| `backend/scripts`      | CLI task có logic và kiểm soát | `verify-manual-constraints.ts`    |
| `prisma/migrations`    | Lịch sử thay đổi schema        | Tạo bảng, index, constraint       |
| `prisma/seed.ts`       | Dữ liệu nền tảng idempotent    | Roles và permissions              |
| `src/modules`          | Nghiệp vụ runtime              | Publish chapter, moderate comment |
| Queue worker           | Công việc nền có retry         | Xử lý outbox, gửi email           |
| Scheduler/cron         | Kích hoạt use case theo lịch   | Publish chapter đến hạn           |
| CI workflow            | Điều phối build/test/deploy    | Migrate rồi smoke test            |

---

## 6. Cấu trúc folder đề xuất

Cấu trúc đích:

```text
backend/scripts/
├── shared/
│   ├── script-context.ts
│   ├── script-error.ts
│   ├── script-logger.ts
│   ├── script-runner.ts
│   ├── script-arguments.ts
│   ├── environment.ts
│   ├── prisma-client.ts
│   └── process-command.ts
│
├── ci/
│   ├── check-environment.ts
│   ├── check-generated-prisma-client.ts
│   └── wait-for-postgres.ts
│
├── database/
│   ├── check-connection.ts
│   ├── reset-local-database.ts
│   ├── verify-migration-status.ts
│   ├── verify-manual-constraints.ts
│   └── verify-seed-data.ts
│
├── development/
│   ├── create-admin.ts
│   └── create-demo-data.ts
│
├── maintenance/
│   ├── cleanup-expired-auth-records.ts
│   ├── reconcile-story-counters.ts
│   ├── publish-due-chapters.ts
│   └── retry-outbox-events.ts
│
├── migrations/
│   └── README.md
│
└── README.md
```

Không cần tạo tất cả ngay. Folder được mở rộng khi có use case thật.

---

## 7. Script cần triển khai theo mức ưu tiên

## P0 — Nền tảng và an toàn

### `ci/check-environment.ts`

Kiểm tra các biến bắt buộc trước build/deploy hoặc trước khi chạy script khác.

Tối thiểu:

```text
DATABASE_URL
NODE_ENV
```

Khi auth được triển khai đầy đủ, bổ sung:

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
```

Script phải:

- Không in secret.
- Chỉ in tên biến thiếu hoặc sai.
- Trả exit code `1` khi không hợp lệ.

---

### `database/check-connection.ts`

Kiểm tra:

- Có thể kết nối PostgreSQL.
- Database trả lời truy vấn đơn giản.
- Có thể đọc migration table nếu đã migrate.

Dùng trong:

- Local troubleshooting.
- CI trước migration.
- Deployment health gate.

---

### `database/reset-local-database.ts`

Thay thế việc ghép `prisma migrate reset` và seed trực tiếp trong `package.json`.

Script phải từ chối chạy nếu:

- `NODE_ENV=production`.
- Host database không thuộc allowlist local/test, trừ khi có flag override rất rõ.
- Không có flag xác nhận như `--confirm-reset`.

Luồng:

```text
validate environment
→ xác nhận target database
→ prisma migrate reset --force --skip-seed
→ tsx prisma/seed.ts
→ verify seed data
```

---

### `database/verify-manual-constraints.ts`

Dự án có `prisma/manual-constraints.sql` chứa các index và constraint PostgreSQL mà Prisma schema không biểu diễn đầy đủ.

Script xác minh sự tồn tại của các đối tượng quan trọng như:

```text
users_email_lower_unique
users_username_lower_unique
author_profiles_pen_name_lower_unique
stories_slug_lower_unique
ratings_score_between_1_and_5
reports_exactly_one_matching_target
story_categories_one_primary_per_story
story_submissions_one_pending_per_story
```

Script này **chỉ kiểm tra**, không tự ý sửa production database.

Việc áp dụng constraints phải được đưa vào migration SQL.

---

### `database/verify-seed-data.ts`

Xác minh:

- Có đủ role `USER`, `AUTHOR`, `ADMIN`.
- Role hệ thống có `isSystem=true`.
- Permission code không thiếu.
- `ADMIN` có toàn bộ permissions.

Dùng sau:

```text
prisma migrate deploy
tsx prisma/seed.ts
```

---

## P1 — Vận hành nghiệp vụ và dữ liệu

### `development/create-admin.ts`

Tạo hoặc nâng cấp một tài khoản thành admin.

Yêu cầu:

- Password không truyền trực tiếp trên command line trong production vì có thể xuất hiện trong shell history.
- Ưu tiên đọc từ environment hoặc stdin.
- Hash bằng cùng thuật toán/config với auth module.
- Dùng transaction.
- Không tạo role `ADMIN` âm thầm nếu seed chưa chạy.
- Có `--dry-run`.
- Upsert có chủ đích, không ghi đè password ngoài ý muốn.

---

### `maintenance/cleanup-expired-auth-records.ts`

Dọn dữ liệu:

- `Session.expiresAt < now`.
- Session đã revoke quá thời gian lưu trữ.
- `UserToken.expiresAt < now`.
- Token đã consumed quá thời gian lưu trữ.
- `UserRole.expiresAt < now` nếu dự án muốn xóa role assignment hết hạn.

Yêu cầu:

- Chạy theo batch.
- Có retention period.
- Có `--dry-run`.
- Log số record, không log token hash.
- Có thể chạy lại an toàn.

---

### `maintenance/reconcile-story-counters.ts`

Đối soát các trường tổng hợp trên `Story`:

```text
followerCount
ratingCount
ratingAverage
chapterCount
commentCount
lastChapterAt
```

Mục tiêu:

- Phát hiện counter lệch với bảng nguồn.
- Mặc định chỉ báo cáo.
- Chỉ sửa khi có `--apply`.
- Có thể giới hạn theo `--story-id`.
- Chạy theo batch để tránh lock dài.

---

### `maintenance/publish-due-chapters.ts`

Schema có:

```text
Chapter.status = SCHEDULED
Chapter.scheduledAt
```

Đây là use case nghiệp vụ, vì vậy không nên viết toàn bộ logic publish trong script.

Cách đúng:

1. Triển khai `PublishDueChaptersUseCase` hoặc service trong `src/modules/chapters`.
2. Worker/scheduler production gọi use case.
3. Script chỉ tạo Nest application context và gọi cùng use case để vận hành thủ công.

---

### `maintenance/retry-outbox-events.ts`

Schema có `OutboxEvent` với:

```text
status
attempts
availableAt
processedAt
lastError
```

Tương tự publish chapter, logic xử lý outbox phải nằm trong module runtime/worker. Script chỉ cung cấp lệnh vận hành thủ công có filter và giới hạn.

---

## P2 — Dữ liệu phát triển và backfill

### `development/create-demo-data.ts`

Chỉ chạy ở local/test.

Có thể tạo:

- User thử nghiệm.
- Author profile thử nghiệm.
- Story và chapter mẫu.
- Comment, rating và library entries mẫu.

Không được chạy trong production.

---

### `migrations/*`

Folder này dành cho **data migration một lần**, không phải schema migration.

Ví dụ:

```text
2026-08-backfill-story-slugs.ts
2026-09-normalize-usernames.ts
```

Mỗi script phải có tài liệu kèm theo:

- Lý do.
- Phạm vi dữ liệu.
- Precondition.
- Cách dry-run.
- Cách apply.
- Cách kiểm chứng.
- Khả năng rollback.
- Ngày có thể xóa script.

Nếu thay đổi có thể thực hiện bằng migration SQL rõ ràng và an toàn, ưu tiên migration SQL.

---

## 8. Trách nhiệm từng folder

## `scripts/shared`

Chứa hạ tầng dùng chung cho script:

- Load và validate environment.
- Tạo Prisma client.
- Parse argument.
- Structured logging.
- Chuẩn hóa lỗi.
- Đo thời gian chạy.
- Chạy child process.
- Cleanup resource và trả exit code.

Không chứa logic riêng của User, Story hoặc Chapter.

---

## `scripts/ci`

Các lệnh:

- Không tương tác.
- Chạy deterministic.
- Trả exit code chính xác.
- Không thay đổi dữ liệu trừ khi workflow nói rõ.
- Có output dễ đọc bởi cả người và CI.

---

## `scripts/database`

Các tác vụ liên quan trực tiếp tới database lifecycle và database integrity.

Không chứa business migration tùy tiện.

---

## `scripts/development`

Chỉ phục vụ local hoặc test.

Mọi script phải chặn production ngay đầu chương trình.

---

## `scripts/maintenance`

Các lệnh vận hành và sửa sai dữ liệu.

Mặc định nên:

```text
dry-run
```

và yêu cầu flag rõ ràng để thay đổi dữ liệu:

```text
--apply
```

---

## `scripts/migrations`

Data migration một lần, có version/date trong tên.

Không được import ngược từ `src/` vào script này nếu tạo circular dependency hoặc kéo theo HTTP layer không cần thiết.

---

## 9. Hai kiểu khởi tạo script

## 9.1. Standalone script

Dùng khi chỉ cần:

- Prisma.
- `pg`.
- File system.
- HTTP client độc lập.
- Thuật toán đơn giản.

Ví dụ:

```text
check-connection
verify-manual-constraints
cleanup-expired-auth-records
```

Ưu điểm:

- Khởi động nhanh.
- Ít dependency.
- Dễ chạy trong CI.
- Không kích hoạt toàn bộ global providers.

---

## 9.2. Nest application context script

Dùng khi script cần tái sử dụng use case/service đã được DI quản lý.

Ví dụ:

```text
publish-due-chapters
retry-outbox-events
rebuild-search-index
send-pending-notifications
```

Cách khởi tạo:

```ts
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});

try {
  const useCase = app.get(PublishDueChaptersUseCase);
  await useCase.execute(...);
} finally {
  await app.close();
}
```

Không dùng `NestFactory.create()` vì script không cần mở HTTP server.

### Quy tắc chọn

> Nếu logic là nghiệp vụ runtime, triển khai logic trong `src/` và để script gọi nó.  
> Nếu logic chỉ là database/tooling độc lập, dùng standalone script.

---

## 10. Chuẩn CLI

Mọi script nên hỗ trợ các quy ước chung khi phù hợp:

| Argument              | Ý nghĩa                               |
| --------------------- | ------------------------------------- |
| `--dry-run`           | Chỉ phân tích, không thay đổi dữ liệu |
| `--apply`             | Cho phép thực hiện thay đổi           |
| `--batch-size=500`    | Số bản ghi mỗi batch                  |
| `--limit=1000`        | Giới hạn tổng số bản ghi              |
| `--story-id=<uuid>`   | Giới hạn phạm vi một truyện           |
| `--before=<ISO date>` | Chỉ xử lý dữ liệu trước thời điểm     |
| `--confirm-reset`     | Xác nhận thao tác phá dữ liệu local   |
| `--json`              | Xuất kết quả dạng JSON cho CI         |
| `--help`              | Hiển thị hướng dẫn                    |

Không tự phát minh cách viết khác nhau giữa các script như:

```text
--dry
--really-do-it
--execute=true
```

---

## 11. Chuẩn log

Mỗi script nên log:

1. Tên script.
2. Environment.
3. Database target đã che thông tin nhạy cảm.
4. Chế độ `dry-run` hay `apply`.
5. Phạm vi xử lý.
6. Số record đọc/thay đổi/bỏ qua/lỗi.
7. Thời gian chạy.
8. Kết quả cuối.

Ví dụ:

```text
[reconcile-story-counters] started
environment=staging mode=dry-run batchSize=200
scanned=1200 mismatched=14 updated=0 failed=0
completed durationMs=1842
```

Không log:

- `DATABASE_URL` đầy đủ.
- Password.
- JWT secret.
- Refresh token.
- Token hash.
- OAuth access token.
- Nội dung riêng tư không cần thiết.

---

## 12. Exit code

Quy ước:

| Exit code | Ý nghĩa                                        |
| --------- | ---------------------------------------------- |
| `0`       | Thành công                                     |
| `1`       | Lỗi thực thi hoặc validation                   |
| `2`       | Dùng command sai / thiếu argument              |
| `3`       | Từ chối vì safety guard                        |
| `4`       | Integrity check thất bại                       |
| `5`       | Có chênh lệch được phát hiện trong verify mode |

Trong thực tế Node chỉ cần đặt:

```ts
process.exitCode = 1;
```

Không gọi `process.exit()` ngay khi còn resource/log cần flush.

---

## 13. Quy tắc an toàn bắt buộc

### 13.1. Production guard

Script phá hoặc sửa dữ liệu phải kiểm tra:

```text
NODE_ENV
DATABASE_URL target
explicit flag
```

Không chỉ dựa vào `NODE_ENV`, vì biến này có thể bị đặt sai.

---

### 13.2. Dry-run mặc định

Các script maintenance nên không thay đổi gì khi không có `--apply`.

Ví dụ:

```bash
npm run maintenance:story-counters
```

chỉ báo cáo.

Muốn sửa:

```bash
npm run maintenance:story-counters -- --apply
```

---

### 13.3. Batch và transaction nhỏ

Không mở một transaction cho hàng triệu record.

Dùng:

- Cursor pagination.
- Batch nhỏ.
- Transaction theo batch.
- Checkpoint hoặc resumable cursor nếu tác vụ dài.

---

### 13.4. Idempotency

Chạy lại script không được tạo dữ liệu trùng hoặc phá trạng thái đúng.

Ví dụ:

- `create-admin` dùng upsert hoặc kiểm tra assignment.
- `cleanup` chỉ xóa record thỏa điều kiện.
- `verify` không thay đổi dữ liệu.
- Backfill chỉ cập nhật field đang thiếu hoặc có version marker.

---

### 13.5. Không bỏ qua lỗi bằng shell

Không dùng:

```json
"some:task": "command-a; command-b"
```

khi `command-b` phụ thuộc vào thành công của `command-a`.

Dùng:

```json
"some:task": "command-a && command-b"
```

hoặc tốt hơn là điều phối bằng TypeScript và kiểm tra exit code.

---

### 13.6. Backup và rollback

Trước data migration production:

- Xác nhận backup gần nhất.
- Ghi lại query kiểm chứng.
- Có rollback hoặc chiến lược forward-fix.
- Ước lượng số bản ghi và lock.
- Chạy dry-run trên snapshot/staging trước.

---

## 14. Manual constraints trong dự án

`prisma/manual-constraints.sql` đang chứa các PostgreSQL constraint/index quan trọng.

Cách quản lý đúng:

1. Tạo Prisma migration bằng `--create-only`.
2. Chèn SQL từ `manual-constraints.sql` vào `migration.sql`.
3. Review SQL.
4. Áp dụng migration local.
5. Chạy `verify-manual-constraints.ts`.
6. Commit migration.
7. Production chạy `prisma migrate deploy`.

Không nên dùng một script production để đọc `manual-constraints.sql` và chạy lại nhiều lần, vì file hiện tại không được viết idempotent; nhiều câu lệnh sẽ lỗi nếu index/constraint đã tồn tại.

Script trong `backend/scripts` nên **verify**, không thay thế migration history.

---

## 15. Bảo mật environment

File example environment chỉ được chứa placeholder:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

Không commit credential thật hoặc chuỗi có vẻ là credential thật.

Nếu repository từng chứa credential hoạt động:

1. Rotate credential ngay.
2. Xóa khỏi branch hiện tại.
3. Cân nhắc xóa khỏi Git history.
4. Kiểm tra access log.
5. Bổ sung secret scanning.

Script log cũng phải che password trong database URL.

---

## 16. Package scripts đề xuất

Giai đoạn đầu:

```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",
    "db:reset:local": "tsx scripts/database/reset-local-database.ts",
    "db:check": "tsx scripts/database/check-connection.ts",
    "db:verify": "tsx scripts/database/verify-database.ts",
    "db:verify:constraints": "tsx scripts/database/verify-manual-constraints.ts",
    "db:verify:seed": "tsx scripts/database/verify-seed-data.ts",

    "ci:check-env": "tsx scripts/ci/check-environment.ts",
    "ci:wait-db": "tsx scripts/ci/wait-for-postgres.ts",

    "admin:create": "tsx scripts/development/create-admin.ts",

    "maintenance:auth-cleanup": "tsx scripts/maintenance/cleanup-expired-auth-records.ts",
    "maintenance:story-counters": "tsx scripts/maintenance/reconcile-story-counters.ts"
  }
}
```

Không thêm alias cho script chưa tồn tại.

---

## 17. Testing strategy

### Unit test

Test các helper:

- Parse arguments.
- Production guard.
- Mask database URL.
- Date/batch validation.
- Mapping exit code.
- Counter comparison.

### Integration test

Dùng database test riêng để kiểm tra:

- Cleanup xóa đúng record.
- Create admin không tạo duplicate role assignment.
- Reconcile phát hiện và sửa counter.
- Verify constraints phát hiện object thiếu.

### Smoke test

Trong CI:

```text
generate Prisma client
→ start PostgreSQL
→ migrate deploy
→ seed
→ verify database
→ run backend tests
```

Không chạy reset trên database dùng chung.

---

## 18. Quy tắc review

Mọi pull request thêm script cần trả lời:

- Script giải quyết vấn đề gì?
- Vì sao không phải migration hoặc code trong module?
- Có thay đổi dữ liệu không?
- Dry-run ở đâu?
- Production guard ở đâu?
- Có idempotent không?
- Có batch không?
- Có log secret không?
- Exit code có dùng được trong CI không?
- Có hướng dẫn rollback/verify không?
- Script là lâu dài hay data migration một lần?
- Ai chịu trách nhiệm xóa script khi không còn dùng?

---

## 19. Những anti-pattern cần tránh

### Import controller vào script

Script không gọi controller. Controller là HTTP adapter.

### Copy code hash password

Không sao chép cấu hình bcrypt riêng trong `create-admin`. Dùng cùng password hasher hoặc constant của auth module.

### Chạy production bằng `tsx` không kiểm soát

`tsx` phù hợp cho tooling, nhưng production maintenance task cần pin version dependency và chạy từ artifact/repository đã review.

### Script tự mở HTTP port

Script dùng application context, không mở server.

### Catch lỗi rồi vẫn exit `0`

CI sẽ hiểu sai là thành công.

### Truy vấn toàn bảng không batch

Có thể gây memory spike và lock kéo dài.

### Sửa counter mà không báo chênh lệch

Mặc định report trước, apply sau.

### Script trở thành cron vĩnh viễn

Nếu chạy định kỳ và là chức năng hệ thống, chuyển sang scheduler/worker module.

---

## 20. Lộ trình triển khai

### Giai đoạn 1

- [ ] Tạo `scripts/shared`.
- [ ] Tạo runner, logger, environment và Prisma helper.
- [ ] Sửa `db:seed`.
- [ ] Tạo `check-environment`.
- [ ] Tạo `check-connection`.
- [ ] Tạo `reset-local-database`.
- [ ] Tạo verify seed và manual constraints.

### Giai đoạn 2

- [ ] Tạo `create-admin`.
- [ ] Tạo cleanup session/token.
- [ ] Tạo reconcile story counters.
- [ ] Viết integration test.

### Giai đoạn 3

- [ ] Kết nối CI/CD.
- [ ] Chạy verify sau migrate và seed.
- [ ] Đưa tác vụ định kỳ sang scheduler/worker.
- [ ] Thêm runbook production.

---

## 21. Definition of Done

Folder `backend/scripts` được xem là triển khai đúng khi:

- [ ] `db:seed` không reset database.
- [ ] Reset local có production guard và xác nhận rõ.
- [ ] Shared runner luôn cleanup Prisma/Nest context.
- [ ] Script thay đổi dữ liệu có dry-run hoặc flag apply.
- [ ] Script chạy batch khi số record có thể lớn.
- [ ] Không log secret.
- [ ] Exit code phản ánh chính xác kết quả.
- [ ] Manual constraints được quản lý qua migration và có verify script.
- [ ] Script nghiệp vụ gọi use case trong `src/`, không copy logic.
- [ ] Có tài liệu command và ví dụ.
- [ ] CI có thể chạy environment/database verification.
- [ ] `npm run build`, `npm run lint` và test đều thành công.

---

## 22. Kết luận

`backend/scripts` không phải folder để chứa mọi command tiện ích. Nó là một **operational CLI layer** có quy tắc rõ ràng.

Đối với dự án Quản lý truyện, ưu tiên không phải tạo thật nhiều script mà là tạo một nền tảng an toàn cho các tác vụ có nhu cầu thật:

```text
check environment
check database
reset local safely
verify migration/constraints/seed
create initial admin
clean expired auth data
reconcile story counters
```

Mọi script mới phải giữ được ba đặc tính:

```text
rõ phạm vi
chạy lại an toàn
không làm production bất ngờ
```
