# HƯỚNG DẪN SỬA NỐT CLOUDINARY, AUTH VÀ MEDIA

## 1. Mục tiêu

Hoàn thiện phần Cloudinary/media để chạy end-to-end trong backend thực tế.

Các vấn đề còn lại:

1. Media API chưa có JWT principal thật.
2. Passport strategy/global guard chưa được wire vào `AppModule`.
3. E2E đang mock toàn bộ service và tự gắn `req.user`.
4. Webhook payload validation/lifecycle còn lỏng.
5. Webhook inbox processor chưa tự chạy trong worker.
6. Cleanup có thể bỏ orphan khi actual resource type khác expected.
7. Event key webhook có thể rỗng.
8. Delete chưa có admin permission.
9. Test coverage thiếu.
10. Hai `.env.example` có thể mâu thuẫn.
11. `AGENTS.md` tại root đang rỗng.

Không refactor ngoài auth, media, Cloudinary, webhook, worker, Prisma và test liên quan.

---

## 2. Kiểm tra trước khi sửa

1. Đọc toàn bộ `AGENTS.md`.
2. Đọc toàn bộ file này.
3. Chạy:

```bash
git status --short
git diff --stat
git diff
```

4. Đọc tối thiểu:

```text
backend/src/app.module.ts
backend/src/worker.module.ts
backend/src/common/guards/
backend/src/common/decorators/
backend/src/common/interfaces/
backend/src/config/
backend/src/infrastructure/media/
backend/src/infrastructure/queue/
backend/src/infrastructure/idempotency/
backend/prisma/schema.prisma
backend/prisma/migrations/
backend/test/
backend/package.json
backend/.env.example
backend/docs/.env.example
```

5. Xác minh tên strategy, permission, token và module thực tế trước khi sửa.

---

# PHẦN A — BLOCKER P0

## A1. Hoàn thiện JWT authentication

### Vấn đề

`MediaController` dùng `@CurrentUser('userId')`, nhưng runtime chưa đảm bảo:

- Passport strategy tồn tại.
- Strategy name trùng với guard.
- JWT được verify.
- Guard được import/đăng ký.
- `request.user` có principal.

Controller test tự gắn `req.user`, nên không phát hiện lỗi này.

### Yêu cầu

Tạo hoặc hoàn thiện auth module theo kiến trúc hiện có. Có thể dùng:

```text
src/modules/auth/
├── auth.module.ts
├── strategies/
│   └── jwt-access.strategy.ts
├── services/
│   └── access-token-validation.service.ts
└── interfaces/
    └── authenticated-principal.interface.ts
```

Không tạo bản trùng nếu repository đã có vị trí khác.

JWT strategy phải:

- Dùng đúng strategy name mà `JwtAuthGuard` gọi, ví dụ `jwt-access`.
- Đọc secret/config qua `ConfigService`.
- Verify expiration và signature.
- Kiểm tra token type nếu payload có.
- Dùng `sub` làm user ID.
- Kiểm tra session/token version nếu schema hiện tại hỗ trợ.
- Trả principal:

```ts
{
  userId: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
}
```

Module wiring:

- `AppModule` import auth/security module.
- Global guard đăng ký thực sự bằng `APP_GUARD` hoặc bootstrap convention hiện có.
- Không import guard mà thiếu strategy.
- `WorkerModule` không phụ thuộc HTTP guard nếu không cần.

Public route:

- Health.
- Cloudinary webhook.

Dùng `@Public()` hiện có. Webhook vẫn bắt buộc Cloudinary signature.

### Done

- Không token → 401.
- Token sai → 401.
- Token đúng → `request.user`.
- `@CurrentUser('userId')` nhận đúng ID.
- Không có lỗi `Unknown authentication strategy`.
- API/worker bootstrap khi Cloudinary disabled.

---

## A2. Hoàn thiện media authorization

### Yêu cầu

Tái sử dụng permission system hiện có. Có thể cần các permission tương đương:

```text
media:create
media:read
media:delete:own
media:delete:any
story:media:manage
chapter:media:manage
```

Không bắt buộc đúng chuỗi nếu convention hiện tại khác.

Tạo/tái sử dụng `MediaAuthorizationService` để xử lý:

- Avatar thuộc user hiện tại.
- Author banner thuộc author profile hợp lệ.
- Story cover thuộc story actor được quản lý.
- Chapter image thuộc chapter/story actor được quản lý.
- Uploader được xóa media của mình.
- Admin chỉ được override khi có permission `delete:any` hoặc tương đương.
- Không tin `ownerId` từ client.

Service nên nhận principal/actor, không chỉ user ID nếu cần kiểm tra permission.

### Done

- User khác → 403.
- Admin có permission → được phép.
- Admin thiếu permission → không bypass.
- Author không sở hữu story/chapter → 403.
- Ownership được test với database/repository thật.

---

## A3. Viết lại media E2E

Test hiện tại nếu mock toàn bộ `MediaService` phải đổi tên thành controller/integration test, không gọi là E2E.

E2E mới phải dùng:

- `AppModule`, hoặc
- Root testing module gần runtime thật.

Áp dụng:

- Global prefix.
- Validation pipe.
- Exception filters.
- Response interceptors.
- Auth guard và JWT strategy.

Có thể override:

- `MEDIA_STORAGE` bằng fake adapter.
- External queue/provider.
- Network call.

Không mock `MediaService` trong workflow E2E chính.

### Luồng bắt buộc

#### Image

```text
token hợp lệ
→ POST upload intent
→ DB PENDING
→ fake provider authoritative lookup
→ POST confirm
→ DB READY
→ GET media
→ có delivery URL
→ DELETE media
→ DB DELETED
```

#### Raw attachment

```text
token hợp lệ
→ tạo PDF intent
→ public ID có .pdf
→ confirm
→ resourceType RAW
→ delete dùng đúng public ID có extension
```

#### Auth/authz

- Không token → 401.
- Token sai → 401.
- Token user khác → 403.
- Admin permission → thành công.

#### Concurrency

- Hai confirm đồng thời.
- Chỉ một claim PROCESSING thành công.
- Provider lookup không bị gọi hai lần ngoài thiết kế.
- Request còn lại idempotent hoặc conflict đúng convention.

### Done

- Không tự gắn `req.user`.
- Không mock toàn bộ MediaService.
- Kiểm tra DB state.
- Chứng minh auth wiring hoạt động.

---

# PHẦN B — WEBHOOK

## B1. Siết payload validation

Webhook không được chấp nhận mọi JSON object rồi đánh dấu processed.

Tạo DTO/schema/validator tối thiểu cho:

```text
notification_id hoặc provider event identifier
notification_type/event type
public_id khi event yêu cầu
resource_type khi event liên quan asset
asset_id/provider asset id nếu có
version/timestamp nếu có
```

Phân loại:

- Supported và xử lý được.
- Hợp lệ nhưng không cần xử lý.
- Invalid.
- Unsupported.

Status nên có:

```text
PENDING
PROCESSING
PROCESSED
IGNORED
FAILED
DEAD_LETTER
```

hoặc tên tương đương.

Sửa event key:

```ts
typeof providerKey === 'string'
&& providerKey.trim().length > 0
&& providerKey.length <= 255
```

Nếu thiếu/rỗng, dùng deterministic hash từ raw body và provider.

### Done

- Invalid JSON bị từ chối.
- Thiếu header bị từ chối.
- Stale timestamp bị từ chối.
- Signature sai bị từ chối.
- Payload thiếu field bắt buộc không thành processed giả.
- Unsupported event → IGNORED.
- Duplicate không xử lý hai lần.
- Event key không rỗng.

---

## B2. Worker tự xử lý webhook inbox

Maintenance command chạy một batch không đủ.

Ưu tiên tích hợp worker hiện có.

### Cách ưu tiên: BullMQ

- Receiver persist inbox event.
- Enqueue job bằng event ID.
- Job ID dùng event ID/event key để deduplicate.
- Worker gọi inbox processor.
- Có retry/backoff.
- Có reconciliation cho event đã persist nhưng enqueue thất bại.

### Hoặc polling worker

- Interval có kiểm soát.
- Claim batch atomically.
- Có shutdown hook.
- Không busy loop.
- Có retry/dead-letter.

Giữ maintenance script làm công cụ thủ công nếu hữu ích.

Không query PENDING rồi xử lý mà không claim.

### Done

- Không cần chạy command tay.
- Hai worker không xử lý cùng event.
- Lỗi retryable được retry.
- Lỗi non-retryable → ignored/dead-letter.
- Có log context.

---

## B3. Cập nhật media từ webhook an toàn

- Match bằng provider asset ID hoặc public ID + resource type.
- Kiểm tra version/timestamp để event cũ không ghi đè event mới.
- Chỉ cập nhật field được phép.
- Không đổi ownership/purpose.
- Không tự chuyển READY nếu chưa đủ authoritative validation.
- Delete event idempotent.
- Có test event đến sai thứ tự.

---

# PHẦN C — CLEANUP

## C1. Resource type mismatch fallback

Client có thể sửa endpoint từ image sang raw/video. Confirm có thể fail đúng nhưng cleanup expected type có thể bỏ orphan.

Cleanup phải:

1. Thử expected resource type.
2. Nếu not found và record chưa confirm:
   - Lookup/thử các resource type hợp lý: image, video, raw.
3. Không đánh dấu xóa thành công nếu actual provider asset vẫn tồn tại.
4. Log fallback.
5. Không xóa asset thuộc record khác.

Có thể mở rộng port:

```ts
findResourceAcrossTypes(publicId: string)
```

hoặc:

```ts
destroyCandidates([
  { publicId, resourceType: 'image' },
  { publicId, resourceType: 'video' },
  { publicId, resourceType: 'raw' },
])
```

Raw public ID giữ extension.

### Done

- Image intent nhưng actual raw asset được cleanup.
- Cleanup idempotent.
- Provider not found xử lý đúng.
- Không xóa nhầm READY asset.
- Có test fallback.

---

## C2. Cleanup lifecycle

Xử lý:

| Status | Điều kiện | Hành động |
|---|---|---|
| PENDING | confirm TTL hết | destroy rồi DELETED/DELETE_FAILED |
| UPLOADED | treo | verify hoặc cleanup |
| PROCESSING | treo | recover hoặc FAILED |
| FAILED | có expected ID | cleanup provider |
| DELETE_FAILED | đến retry time | retry |
| DELETING | treo | resume/retry |

Thêm field khi thực sự cần:

```text
deleteAttempts
nextDeleteAttemptAt
lastProviderErrorCode
processingStartedAt
```

Kèm migration thật.

Retry có backoff và giới hạn.

---

# PHẦN D — CONFIG VÀ DOCS

## D1. Khôi phục `AGENTS.md`

Đặt file `AGENTS.md` ở root và bảo đảm không còn 0 byte.

Kiểm tra:

```bash
wc -c AGENTS.md
```

## D2. Giải quyết hai `.env.example`

Ưu tiên:

- Giữ `backend/.env.example` là nguồn chính.
- Xóa `backend/docs/.env.example`, hoặc đổi tên rõ mục đích.
- Docs link đến file chính.

Không để hai file cùng tên nhưng nội dung khác.

## D3. Cập nhật Cloudinary docs

Phải mô tả:

- Enable/disable.
- Credential.
- Signed presets.
- Attachment preset.
- Folder mode.
- Allowed formats/max size.
- Webhook URL/timestamp tolerance.
- Worker processing.
- Cleanup/retry.
- Raw public ID extension.
- Confirm TTL khác Cloudinary signature lifetime.
- Migration.
- Local mode disabled.
- Fake adapter trong test.

---

# PHẦN E — TEST BẮT BUỘC

## Authentication

- AuthModule bootstrap.
- Strategy name đúng.
- Token valid/expired/bad signature.
- Public route.
- Protected media route.
- CurrentUser đọc đúng.

## Config/module

- AppModule bootstrap khi disabled.
- WorkerModule bootstrap khi disabled.
- Enabled thiếu credential/preset fail fast.
- `MEDIA_STORAGE` chọn đúng adapter.

## Upload intent

- Avatar.
- Story/chapter ownership.
- PDF attachment.
- Raw `.pdf`.
- Traversal.
- MIME-extension mismatch.
- Size quá lớn.
- Purpose sai.
- Expected identity lưu trước upload.

## Confirm

- Signature sai.
- Public ID/resource type/folder/format/size sai.
- Expired.
- User khác.
- Thành công.
- Lặp sau READY.
- Concurrent confirm.
- Provider error state.

## Delete

- Uploader.
- User khác.
- Admin permission.
- Provider ok/not found/error.
- Retry DELETE_FAILED.
- Concurrent delete.
- Metadata merge.
- Raw extension.

## Cleanup

- PENDING hết hạn.
- PENDING có image.
- Image intent/actual raw.
- FAILED orphan.
- PROCESSING treo.
- DELETE_FAILED retry.
- Retry limit.
- Idempotency.

## Webhook

- Header/timestamp/signature/JSON sai.
- Empty event key fallback.
- Duplicate.
- DB failure không trả success giả.
- Unsupported → IGNORED.
- Supported → PROCESSED.
- Worker failure/retry.
- Hai worker.
- Out-of-order event.

## E2E

Tối thiểu:

1. Authenticated image lifecycle.
2. Raw attachment lifecycle.
3. Unauthorized.
4. Ownership forbidden.
5. Admin override.
6. Duplicate confirm.
7. Delete not found/retry.
8. Webhook receive → inbox → worker process.

---

# PHẦN F — MIGRATION

Nếu thay đổi enum/status/retry field/permission seed, tạo migration thật:

```bash
npm run db:migrate -- --name complete_media_auth_webhook_lifecycle
```

Không dùng `prisma db push`.

Kiểm tra:

```bash
git check-ignore -v prisma/migrations/<migration>/migration.sql
```

Migration SQL không được bị ignore.

---

# PHẦN G — THỨ TỰ SỬA

1. Khôi phục `AGENTS.md`.
2. Hoàn thiện JWT strategy/auth module.
3. Wire global guard.
4. Hoàn thiện media authorization/admin permission.
5. Viết auth/module tests.
6. Viết lại media E2E.
7. Siết webhook validation/event key.
8. Hoàn thiện webhook status.
9. Tích hợp processor vào worker.
10. Sửa cleanup resource type mismatch.
11. Hoàn thiện cleanup retry.
12. Tạo migration nếu cần.
13. Đồng bộ env/docs.
14. Chạy quality gates.
15. Rà soát diff.

---

# PHẦN H — QUALITY GATES

Chạy từ `backend/` theo script thực tế:

```bash
npm ci
npx prisma validate --config prisma.config.ts
npx prisma generate --config prisma.config.ts
npm run typecheck:scripts
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Nếu package mirror lỗi:

- Ghi package/registry lỗi.
- Không nói pass.
- Tiếp tục static review.
- Phân loại `FAIL_ENVIRONMENT`.

Sau lint:

```bash
git diff --stat
git diff
```

Hoàn tác format ngoài phạm vi.

---

# PHẦN I — DEFINITION OF DONE

- [ ] `AGENTS.md` không rỗng.
- [ ] AppModule có JWT strategy hoạt động.
- [ ] Media route không token trả 401.
- [ ] `@CurrentUser()` nhận principal thật.
- [ ] Webhook public đối với JWT nhưng verify provider signature.
- [ ] Ownership hoạt động.
- [ ] Admin permission hoạt động.
- [ ] E2E không tự gắn `req.user`.
- [ ] E2E không mock toàn bộ MediaService.
- [ ] E2E kiểm tra DB lifecycle.
- [ ] Event key không rỗng.
- [ ] Unsupported event không thành processed giả.
- [ ] Worker tự xử lý inbox.
- [ ] Hai worker không xử lý cùng event.
- [ ] Cleanup xử lý actual type khác expected.
- [ ] Raw extension xuyên suốt upload-confirm-delete.
- [ ] Migration tồn tại nếu schema đổi.
- [ ] Migration không bị ignore.
- [ ] `.env.example` không mâu thuẫn.
- [ ] Docs khớp code.
- [ ] Test bắt buộc được thêm.
- [ ] Build/lint/test pass hoặc lỗi môi trường được báo đúng.
- [ ] Không secret.
- [ ] Không placeholder.
- [ ] Không thay đổi ngoài phạm vi chưa giải thích.

---

# PHẦN J — PROMPT DÁN CHO CODEX

```text
Hãy sửa hoàn chỉnh các vấn đề còn lại của authentication, Cloudinary media lifecycle, webhook inbox/worker, cleanup và test theo `huong-dan.md`.

Trước khi sửa:

1. Đọc toàn bộ `AGENTS.md`.
2. Đọc toàn bộ `huong-dan.md`.
3. Kiểm tra `git status`, `git diff --stat` và `git diff`.
4. Đọc code thực tế liên quan trước khi quyết định.

Xem `huong-dan.md` là đặc tả triển khai chính.

Yêu cầu:

- Trực tiếp sửa code, migration, test và tài liệu.
- Không chỉ phân tích/lập kế hoạch.
- Không refactor ngoài phạm vi.
- Không hoàn tác thay đổi không liên quan.
- Không thêm placeholder hoặc endpoint success giả.
- Hoàn thiện JWT access strategy và module wiring thật.
- Media API dùng authenticated principal thật.
- Hoàn thiện authorization uploader/owner/admin permission.
- Viết E2E gần runtime thật, không mock toàn bộ MediaService.
- Webhook validate payload, event key không rỗng, deduplicate và có ignored/failed rõ.
- Inbox được worker xử lý tự động và atomically.
- Cleanup xử lý orphan khi actual resource type khác expected.
- Raw public ID giữ extension qua upload, confirm và delete.
- Tạo migration Prisma thật nếu schema đổi.
- Không dùng prisma db push.
- Đồng bộ `.env.example` và docs.
- Thêm test theo danh sách trong `huong-dan.md`.

Chạy quality gates có trong package.json, tối thiểu:

npm ci
npx prisma validate --config prisma.config.ts
npx prisma generate --config prisma.config.ts
npm run typecheck:scripts
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand

Nếu command thất bại do môi trường/package mirror:

- Không nói pass.
- Ghi command và lỗi cụ thể.
- Phân loại lỗi.
- Tiếp tục phần còn có thể làm.

Trước khi kết thúc:

- Đối chiếu từng checkbox Definition of Done.
- Kiểm tra migration SQL không bị ignore.
- Kiểm tra API/worker bootstrap khi Cloudinary disabled.
- Kiểm tra không log secret/signature.
- Kiểm tra git diff và thay đổi ngoài phạm vi.

Báo cáo cuối:

## Files changed
## Architecture decisions
## Database changes
## API changes
## Security and authorization
## Tests added or updated
## Commands executed
## Git diff summary
## Remaining limitations

Không mô tả phần chưa hoàn thành là đã hoàn thành.
```
