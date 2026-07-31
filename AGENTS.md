# AGENTS.md

## 1. Phạm vi và thứ tự ưu tiên

File này chứa quy tắc lâu dài cho mọi coding agent làm việc trong repository `Quan_ly_truyen`.

Thứ tự ưu tiên:

1. Prompt hiện tại của người dùng.
2. Tài liệu đặc tả được prompt chỉ định, ví dụ `huong-dan.md`.
3. `AGENTS.md` gần file đang sửa nhất.
4. `AGENTS.md` tại root.
5. Kiến trúc và convention đang tồn tại trong repository.
6. Giải pháp an toàn, ít phá vỡ và dễ kiểm thử nhất.

Không được bỏ qua yêu cầu trong tài liệu đặc tả mà không giải thích trong báo cáo cuối.

---

## 2. Tổng quan backend

Backend là nền tảng quản lý, xuất bản và đọc truyện, có các vai trò:

- `GUEST`
- `USER`
- `AUTHOR`
- `ADMIN`

Công nghệ chính:

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Passport/JWT
- Cloudinary
- class-validator/class-transformer
- Jest hoặc test runner hiện có

Cấu trúc chính:

```text
backend/
├── prisma/
├── scripts/
├── src/
│   ├── bootstrap/
│   ├── common/
│   ├── config/
│   ├── health/
│   ├── infrastructure/
│   ├── modules/
│   ├── app.module.ts
│   ├── main.ts
│   ├── worker.module.ts
│   └── worker.ts
└── test/
```

---

## 3. Cách agent phải làm việc

Trước khi sửa:

1. Đọc prompt đầy đủ.
2. Đọc toàn bộ file đặc tả được tham chiếu.
3. Chạy hoặc kiểm tra:
   ```bash
   git status --short
   git diff --stat
   git diff
   ```
4. Đọc module, config, Prisma schema, migration và test liên quan.
5. Tìm abstraction hiện có trước khi tạo abstraction mới.
6. Bảo toàn thay đổi không liên quan của người dùng.
7. Lập kế hoạch nội bộ ngắn rồi trực tiếp triển khai.

Trong khi sửa:

- Không chỉ phân tích hoặc viết kế hoạch.
- Không dừng lại để hỏi xác nhận cho quyết định thông thường.
- Không refactor ngoài phạm vi.
- Không đổi tên hàng loạt nếu không cần.
- Không thêm placeholder, fake implementation hoặc `TODO` thay logic thật.
- Không tạo endpoint trả success giả.
- Không tắt lint, test, validation hoặc guard để làm pipeline pass.
- Không tạo commit nếu người dùng không yêu cầu.
- Không sửa `node_modules`, `dist`, coverage hoặc generated build output.
- Không nói command đã pass nếu chưa chạy thành công.

Nếu môi trường bị lỗi:

- Hoàn thành mọi phần source còn có thể làm.
- Ghi chính xác command và lỗi.
- Phân biệt `FAIL_SOURCE` với `FAIL_ENVIRONMENT`.
- Không mô tả phần chưa kiểm chứng là đã hoàn thành.

---

## 4. Kiến trúc NestJS

### Controller

Controller chỉ nên:

- Nhận request và bind DTO.
- Đọc authenticated principal.
- Áp dụng decorator, guard và permission.
- Gọi application service.
- Trả response theo convention dự án.

Controller không được:

- Gọi Cloudinary SDK trực tiếp.
- Chứa transaction hoặc business workflow dài.
- Tự kiểm tra role bằng chuỗi rời rạc nếu permission system đã tồn tại.
- Gọi Prisma trực tiếp cho workflow nhiều bước.

### Service

Service chịu trách nhiệm:

- Điều phối use case.
- Áp dụng business rule.
- Gọi port/repository.
- Quản lý transaction và state transition.
- Bảo vệ idempotency/concurrency.
- Ném exception thuộc application/domain phù hợp.

### Port và adapter

- Port định nghĩa contract ở biên hệ thống.
- Adapter triển khai provider như Cloudinary, Redis hoặc BullMQ.
- Module nghiệp vụ không phụ thuộc trực tiếp SDK ngoài nếu đã có port.
- Không tạo abstraction trùng chức năng.

### Worker

Worker dùng cho:

- Job retryable.
- Webhook inbox.
- Outbox.
- Cleanup.
- Email.
- Notification.
- Media processing.

API không giữ request mở chỉ để chờ công việc nền dài.

---

## 5. Quy tắc `src/common`

`src/common` chỉ chứa thành phần dùng chung thực sự.

Trước khi thêm vào `common`, kiểm tra:

- Có ít nhất hai module độc lập cần dùng không?
- Có phụ thuộc domain cụ thể không?
- Có trùng guard, pipe, filter, interceptor, decorator, exception hoặc util hiện có không?

Không đưa DTO hoặc business rule riêng của story/media vào `common`.

Ưu tiên tái sử dụng:

- Exception hiện có.
- Guard/decorator hiện có.
- Request context.
- Logger.
- Pagination.
- Response envelope.
- Validation helper.

Không tạo util chỉ để bọc một dòng code nếu không có abstraction có ý nghĩa.

---

## 6. Authentication và authorization

Authentication và authorization là hai lớp riêng.

### Authentication

- Passport strategy phải được đăng ký thực sự.
- Strategy name phải trùng với guard.
- Guard phải tạo principal trên `request.user`.
- Không tin `userId`, role hoặc permission client gửi tùy ý.
- Public route phải dùng decorator hiện có.
- Webhook public đối với JWT nhưng bắt buộc provider signature.

Principal tối thiểu:

```ts
interface AuthenticatedPrincipal {
  userId: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
}
```

Không giả định `request.user` tồn tại nếu strategy và guard chưa được wire vào runtime module.

### Authorization

- Dùng permission cho hành động quản trị/nhạy cảm.
- Dùng ownership check cho user, author, story, chapter và media.
- Không thêm admin bypass ngầm.
- Mọi endpoint sửa/xóa phải có authorization path rõ.
- Không dùng owner ID từ body/query mà không verify.

Test phải có:

- Không token.
- Token sai.
- Có token nhưng không sở hữu.
- Có permission admin.
- User hợp lệ và sở hữu.

---

## 7. DTO và validation

Mọi input HTTP, queue, webhook và script đều không đáng tin cậy.

DTO phải:

- Dùng `class-validator`.
- Giới hạn độ dài.
- Validate UUID và enum.
- Không nhận Prisma model trực tiếp.
- Tránh `any`.
- Tôn trọng whitelist/forbidNonWhitelisted của global validation pipe.

Media phải kiểm tra nhiều lớp:

1. Tên file khai báo.
2. Extension.
3. MIME type khai báo.
4. Kích thước khai báo.
5. Policy theo purpose.
6. Dữ liệu authoritative từ provider.

Không dùng dữ liệu client làm authoritative state cuối cùng.

---

## 8. Exception và error response

Không dùng generic `Error` cho lỗi dự kiến.

Mapping khuyến nghị:

| Trường hợp | HTTP |
|---|---:|
| Request không hợp lệ | 400 |
| Chưa đăng nhập | 401 |
| Không có quyền | 403 |
| Không tìm thấy | 404 |
| Trạng thái xung đột | 409 |
| Intent hết hạn | 409 hoặc 410 |
| Payload quá lớn | 413 |
| Media không hỗ trợ | 415 |
| Rate limit | 429 |
| Provider tạm thời lỗi | 503 |

Không trả:

- Stack trace.
- Secret/API key.
- Signature.
- Raw SQL.
- Provider error chứa credential.

Log bằng identifier an toàn: request ID, user ID, resource ID, operation và provider request ID.

---

## 9. Prisma và database

Khi đổi schema:

1. Cập nhật `schema.prisma`.
2. Tạo migration thật.
3. Kiểm tra SQL.
4. Đảm bảo migration không bị ignore.
5. Chạy validate/generate.
6. Cập nhật seed nếu cần.
7. Thêm index/unique constraint phục vụ query, state và idempotency.
8. Cập nhật tài liệu.

Không dùng `prisma db push` thay migration cho thay đổi cần deploy.

Migration phải:

- Không giả định database trống.
- Tránh mất dữ liệu ngoài ý muốn.
- Có backfill nếu thêm field bắt buộc.
- An toàn cho PostgreSQL production.
- Không sửa migration đã áp dụng ở môi trường dùng chung.

---

## 10. Concurrency và idempotency

Workflow dễ bị gọi lặp phải có hành vi xác định:

- Confirm upload.
- Delete media.
- Cleanup.
- Webhook.
- Outbox.
- Queue job.
- Publish story/chapter.
- Follow/unfollow.
- Rating.

Không dùng mẫu:

```text
read current state
→ gọi provider
→ update không điều kiện
```

Ưu tiên:

- Conditional `updateMany`.
- Transaction.
- Unique constraint.
- Idempotency key.
- Distributed lock khi cần.
- Claim state như `PENDING → PROCESSING`.
- Retry có giới hạn.
- Dead-letter hoặc failed state rõ.

Operation idempotent không được tạo side effect mới khi chạy lại.

---

## 11. Cloudinary và media

### Bảo mật

- Không đưa `CLOUDINARY_API_SECRET` ra frontend.
- Không log API secret/full signature payload.
- Tạo upload signature ở backend.
- Verify upload response và webhook signature.
- Kiểm tra webhook timestamp freshness.
- Không đánh dấu READY dựa hoàn toàn vào client.
- Xác minh authoritative resource.
- Cloudinary disabled không làm API/worker crash.
- Disabled adapter không trả URL giả.

### Upload intent

Phải lưu đủ:

- Media asset ID.
- Expected public ID.
- Expected resource type.
- Expected folder.
- Purpose.
- Uploader.
- Owner.
- Confirm expiration.

Phân biệt confirm TTL nội bộ với thời hạn Cloudinary signature.

Raw asset phải có extension trong public ID.

### Confirm

Phải:

- Xác thực actor/uploader.
- Kiểm tra expiry.
- Claim atomically.
- Verify signature.
- Verify public ID/resource type/folder/format/size.
- Lưu provider asset ID/version/delivery metadata.
- Idempotent khi READY.
- Không cho hai request cùng hoàn tất.

### Delete

Phải:

- Kiểm tra ownership hoặc admin permission.
- Claim atomically.
- Coi provider `not found` là idempotent success.
- Có `DELETE_FAILED` và retry path.
- Raw asset dùng đúng public ID có extension.

### Cleanup

Phải xử lý:

- PENDING hết hạn.
- UPLOADED/PROCESSING bị treo.
- FAILED có provider asset.
- DELETE_FAILED.
- Orphan do client không confirm.
- Resource type thực tế khác expected type.
- Retry có backoff/limit.

### Webhook

Phải:

1. Dùng raw body.
2. Verify signature/timestamp.
3. Parse và validate payload.
4. Event key không rỗng.
5. Persist inbox với unique key.
6. Trả success chỉ sau khi persist an toàn.
7. Xử lý async.
8. Không xử lý trùng.
9. Có status `processed`, `ignored`, `failed/dead-letter`.
10. Có retry.

---

## 12. Queue, outbox và inbox

Payload job phải:

- Có interface/schema.
- Có version nếu contract có thể đổi.
- Không chứa secret.
- Có entity ID/idempotency key.
- Có timeout/retry/backoff.

Processor phải:

- Claim atomically.
- Phân biệt retryable/non-retryable.
- Không nuốt exception rồi đánh dấu success.
- Có failed/dead-letter state.
- Không chạy busy loop.
- Không đánh dấu processed trước khi side effect thành công.

---

## 13. Config và environment

Mọi biến môi trường phải:

- Có trong config namespace.
- Có validation.
- Có trong `.env.example`.
- Có tài liệu.
- Không chứa credential thật.

Feature optional phải:

- Có enable flag.
- Bootstrap được khi disabled.
- Không yêu cầu credential khi disabled.
- Fail fast khi enabled nhưng thiếu config.

Không để nhiều `.env.example` cùng tên nhưng nội dung mâu thuẫn.

---

## 14. Test

Mọi thay đổi hành vi phải có test.

### Unit

Dùng cho policy, mapper, public ID, signature, state decision, error mapping.

### Integration

Dùng cho Prisma, transaction, unique constraint, conditional update, inbox/outbox và module wiring.

### E2E

Phải:

- Import `AppModule` hoặc root testing module gần runtime thật.
- Áp dụng global pipe/filter/interceptor.
- Không tự nhét `req.user`.
- Có thể override external provider bằng fake adapter.
- Không mock toàn bộ service của workflow chính.
- Kiểm tra database state.
- Kiểm tra auth và authorization.

Controller test mock service không được gọi là E2E.

Concurrency test phải chứng minh chỉ một claim thành công.

---

## 15. Logging và observability

Không dùng `console.log` trong production code nếu đã có logger.

Log nên có:

- Operation.
- Entity ID.
- User ID.
- Correlation ID.
- Duration.
- Retry count.
- Failure category.

Không log password, token, refresh token, secret, full signed payload hoặc authorization header.

Workflow nền quan trọng nên có metrics/counter tối thiểu.

---

## 16. Dependency

Ưu tiên dependency hiện có.

Chỉ thêm production dependency khi thật sự cần, package được duy trì, lockfile được cập nhật và có test.

Không thay Prisma, logger, validation hoặc Cloudinary SDK nếu không có yêu cầu rõ.

---

## 17. Git và phạm vi

Trước và sau khi sửa:

```bash
git status --short
git diff --stat
git diff
```

Không sửa generated output. Nếu lint format file ngoài phạm vi, phải hoàn tác phần không liên quan.

Migration SQL phải xuất hiện trong working tree và không bị ignore.

---

## 18. Lệnh kiểm tra backend

Chạy từ `backend/`, theo script thực tế trong `package.json`.

Tối thiểu:

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

Nếu đổi schema:

```bash
npm run db:migrate -- --name <ten_migration_ro_rang>
```

Không nói pass khi command không chạy thành công.

---

## 19. Definition of Done

Chỉ hoàn thành khi:

- Logic thật đã triển khai.
- Không placeholder.
- Module wiring runtime hoạt động.
- Auth/authz hoạt động.
- Migration tồn tại nếu schema đổi.
- Config validation đầy đủ.
- Test hành vi chính được thêm.
- Build/lint/test đã chạy hoặc lỗi môi trường được báo trung thực.
- Docs khớp code.
- Không secret.
- Không có thay đổi ngoài phạm vi chưa giải thích.

---

## 20. Báo cáo cuối

Bắt buộc có:

```text
## Files changed
## Architecture decisions
## Database changes
## API changes
## Security and authorization
## Tests added or updated
## Commands executed
## Git diff summary
## Remaining limitations
```

Mỗi command ghi `PASS`, `FAIL_SOURCE`, `FAIL_ENVIRONMENT` hoặc `NOT_RUN` kèm lý do.
