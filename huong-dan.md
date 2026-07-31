# HƯỚNG DẪN SỬA MODULE CLOUDINARY

> Tài liệu giao việc cho Codex trong dự án **Quan_ly_truyen-main**.
>
> Phạm vi chính: `backend/src/infrastructure/media`, cấu hình Cloudinary, Prisma migration, API media, webhook, cleanup và test.

---

## 1. Mục tiêu

Hãy sửa và hoàn thiện phần tích hợp Cloudinary để đạt các yêu cầu sau:

1. Backend vẫn khởi động bình thường khi `CLOUDINARY_ENABLED=false`.
2. Khi Cloudinary bị tắt, chỉ các thao tác media mới trả lỗi phù hợp; không được làm toàn bộ API hoặc worker crash lúc bootstrap.
3. Signed direct upload phải hoạt động end-to-end: tạo intent, upload trực tiếp lên Cloudinary, xác minh kết quả, xác nhận asset và lưu dữ liệu authoritative vào PostgreSQL.
4. Hỗ trợ đúng các loại media đã khai báo, bao gồm `ATTACHMENT` dạng `raw`.
5. Không để lại orphan asset khi intent hết hạn hoặc frontend không gọi confirm.
6. Confirm và delete phải chống race condition, có state transition rõ ràng và idempotent hợp lý.
7. Webhook không được nhận HTTP 200 rồi bỏ payload; phải có xác minh chữ ký, chống xử lý trùng và lưu bền vững trước khi trả thành công.
8. Có controller/DTO để frontend có thể sử dụng module media.
9. Không dùng generic `Error` cho lỗi nghiệp vụ hoặc hạ tầng đã biết.
10. Có Prisma migration, test, tài liệu cấu hình và các lệnh kiểm tra hoàn tất.

---

## 2. Quy tắc bắt buộc khi sửa

- Giữ kiến trúc NestJS hiện tại, gồm port/adapter, service, module và Prisma.
- Không gọi trực tiếp Cloudinary từ module user, author, story hoặc chapter.
- Không đưa `CLOUDINARY_API_SECRET` ra response, log, frontend hoặc test snapshot.
- Không hard-code credential hay upload preset.
- Không dùng `as any` để bỏ qua lỗi type nếu có thể tạo mapper/type guard rõ ràng.
- Không xóa enum hoặc model hiện có chỉ để tránh sửa lỗi.
- Không đổi API công khai một cách tùy tiện; nếu cần đổi field thì phải cập nhật DTO, interface, test và tài liệu cùng lúc.
- Không đánh dấu hoàn thành khi build, lint hoặc test còn lỗi.
- Không sửa lan sang nghiệp vụ truyện ngoài phần cần thiết để xác thực quyền sở hữu media.
- Các message lỗi trả cho client không được chứa Cloudinary secret, full provider response hoặc stack trace.

---

## 3. Hiện trạng cần lưu ý

Các file chính đang có:

```text
backend/src/config/cloudinary.config.ts
backend/src/config/environment.validation.ts
backend/src/infrastructure/media/media.module.ts
backend/src/infrastructure/media/application/media.service.ts
backend/src/infrastructure/media/application/media-query.service.ts
backend/src/infrastructure/media/application/media-cleanup.service.ts
backend/src/infrastructure/media/cloudinary/cloudinary.provider.ts
backend/src/infrastructure/media/cloudinary/cloudinary-media.adapter.ts
backend/src/infrastructure/media/cloudinary/cloudinary-signature.service.ts
backend/src/infrastructure/media/cloudinary/cloudinary-url.service.ts
backend/src/infrastructure/media/cloudinary/cloudinary-webhook.controller.ts
backend/src/infrastructure/media/cloudinary/cloudinary-webhook.service.ts
backend/src/infrastructure/media/policies/media-upload-policy.registry.ts
backend/prisma/schema.prisma
```

Các lỗi chính của code hiện tại:

- `cloudinaryProvider` ném lỗi ngay lúc bootstrap khi `CLOUDINARY_ENABLED=false`.
- Policy `ATTACHMENT` tham chiếu `cloudinary.uploadPresets.attachment`, nhưng config và `.env.example` không có preset này.
- `raw` attachment dùng `public_id` không chứa extension.
- `expiresAt` hiện chỉ là hạn confirm phía backend, không phải thời gian Cloudinary vô hiệu hóa signed upload.
- DB chưa lưu `publicId`, `resourceType`, `assetFolder` dự kiến khi tạo intent, khiến cleanup không xóa được unconfirmed upload.
- Webhook xác minh xong nhưng `processIdempotently()` rỗng.
- Chưa có MediaController để frontend tạo và confirm intent.
- Nhiều lỗi đang dùng generic `Error` và dễ biến thành HTTP 500.
- Confirm/delete chưa có transition nguyên tử để chống hai request chạy đồng thời.
- Chưa có migration SQL được commit; `.gitignore` đang ignore `backend/prisma/migrations/**/*.sql`.
- Chưa có test Cloudinary/media đủ dùng.

---

# PHẦN A — BLOCKER P0

## 4. Làm Cloudinary thực sự optional

### Yêu cầu

Khi cấu hình:

```env
CLOUDINARY_ENABLED=false
```

cả hai lệnh sau phải khởi động được:

```bash
npm run start:dev
npm run start:worker:dev
```

Không được ném lỗi lúc Nest khởi tạo module/provider.

### Cách triển khai yêu cầu

Tạo một adapter fallback, ví dụ:

```text
backend/src/infrastructure/media/adapters/disabled-media-storage.adapter.ts
```

Adapter này phải implement đầy đủ `MediaStoragePort`. Mọi thao tác cần Cloudinary phải ném `ServiceUnavailableException` hoặc exception hạ tầng phù hợp với:

- code ổn định, ví dụ `MEDIA_STORAGE_DISABLED`;
- HTTP status 503;
- message không chứa secret;
- `retryable: false` khi tính năng bị tắt do config.

Chọn implementation của token `MEDIA_STORAGE` theo `cloudinary.enabled`:

```text
true  -> CloudinaryMediaAdapter
false -> DisabledMediaStorageAdapter
```

`cloudinaryProvider` không được tự ném lỗi chỉ vì feature đang disabled.

Các provider phụ thuộc trực tiếp vào Cloudinary client như:

- `CloudinarySignatureService`
- `CloudinaryUrlService`
- `CloudinaryWebhookService`
- `CloudinaryMediaAdapter`

phải được tổ chức để không làm bootstrap thất bại khi disabled. Có thể dùng dynamic module, nullable client token có guard rõ ràng, hoặc provider factory có điều kiện. Chọn một cách nhất quán, dễ test.

Webhook khi Cloudinary disabled phải trả 404 hoặc 503 rõ ràng; không được crash ứng dụng.

### Tiêu chí Done

- Test module bootstrap với `CLOUDINARY_ENABLED=false` pass.
- `AppModule` và `WorkerModule` đều compile/khởi tạo được.
- Gọi thao tác tạo upload intent khi disabled trả lỗi có cấu trúc, không phải generic 500.
- Không cần khai báo cloud name, key, secret hoặc preset khi disabled.

---

## 5. Hoàn thiện config cho `ATTACHMENT`

Không được bỏ `MediaPurpose.ATTACHMENT`. Hãy hỗ trợ đầy đủ.

### Thêm biến môi trường

Trong `backend/.env.example`:

```env
CLOUDINARY_ATTACHMENT_UPLOAD_PRESET=qlt_attachment_signed
```

Trong `cloudinary.config.ts`:

```typescript
uploadPresets: {
  avatar: ...,
  authorBanner: ...,
  storyCover: ...,
  chapterImage: ...,
  attachment: process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET,
}
```

Trong `environment.validation.ts`:

- thêm field tương ứng;
- yêu cầu field này khi `CLOUDINARY_ENABLED=true`;
- giữ validation có điều kiện, không bắt buộc khi feature disabled.

### Policy attachment

Không để `allowedFormats: []`, vì điều đó đang có nghĩa là chấp nhận tùy ý. Dùng whitelist rõ ràng, tối thiểu:

```typescript
allowedFormats: ['pdf', 'txt', 'doc', 'docx', 'zip']
```

Nếu dự án chưa có use case cho một định dạng thì không thêm định dạng đó.

Thêm MIME whitelist tương ứng vào policy, ví dụ:

```typescript
allowedMimeTypes: [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
]
```

Mọi policy nên có cả `allowedFormats` và `allowedMimeTypes`.

### Tiêu chí Done

- Config load được khi bật Cloudinary và có đủ attachment preset.
- Thiếu attachment preset khi enabled phải fail fast với lỗi cấu hình rõ ràng.
- Attachment ngoài whitelist bị từ chối trước khi tạo upload intent.

---

## 6. Chuẩn hóa `publicId` và lưu thông tin dự kiến ngay khi tạo intent

### Vấn đề cần giải quyết

Hiện code mặc định:

```typescript
publicId = mediaAssetId
```

Cách này không đúng cho Cloudinary raw asset vì attachment cần extension trong `public_id`.

### Cách sửa bắt buộc

Tạo helper/service thuần, có test, ví dụ:

```text
backend/src/infrastructure/media/policies/media-public-id.service.ts
```

Quy tắc:

- image/video: `publicId = mediaAssetId`;
- raw attachment: `publicId = mediaAssetId + '.' + extensionĐãValidate`;
- extension lấy từ `originalName`, lowercase và phải nằm trong whitelist;
- không được dùng nguyên tên file người dùng làm public ID;
- từ chối tên không có extension hoặc extension giả/không hợp lệ;
- không cho slash, backslash, null byte hoặc path traversal từ input ảnh hưởng folder/public ID.

Nên tạo UUID ở application layer trước khi insert:

```typescript
const mediaAssetId = randomUUID();
```

Sau đó tính:

- expected public ID;
- expected resource type;
- expected asset folder.

Ngay khi tạo bản ghi `MediaAsset` trạng thái `PENDING`, phải lưu:

```text
id
publicId
resourceType
assetFolder
uploadExpiresAt
storageProvider
```

Không chờ confirm mới lưu các trường dự kiến này.

Sửa contract `CreateSignedUploadInput` để nhận giá trị đã được chuẩn hóa, không tự tính lại ở nhiều nơi. Ví dụ:

```typescript
interface CreateSignedUploadInput {
  mediaAssetId: string;
  purpose: MediaPurpose;
  publicId: string;
  assetFolder: string;
  resourceType: MediaStorageResourceType;
  expiresAt: Date;
}
```

`CloudinarySignatureService` chỉ ký đúng các giá trị application service đã quyết định.

Khi confirm, so sánh:

```typescript
input.dto.publicId === media.publicId
```

không so sánh với `media.id`.

### Tiêu chí Done

- Image public ID là UUID không extension.
- Raw public ID là UUID kèm extension hợp lệ.
- Public ID và asset folder đã có trong DB từ trạng thái `PENDING`.
- Confirm raw asset không thất bại do so sánh với `media.id`.
- Có test path traversal và extension không hợp lệ.

---

## 7. Sửa ý nghĩa TTL và cleanup orphan asset

### Ý nghĩa bắt buộc

`CLOUDINARY_UPLOAD_INTENT_TTL_SECONDS` là **thời hạn backend chấp nhận confirm**, không được mô tả như signed URL chắc chắn hết hiệu lực tại Cloudinary.

Đổi tên field response từ:

```typescript
expiresAt
```

thành:

```typescript
confirmExpiresAt
```

Nếu cần giữ tương thích, có thể tạm trả cả hai field nhưng đánh dấu `expiresAt` deprecated trong interface/tài liệu. Vì frontend hiện chưa triển khai, ưu tiên đổi sạch sang `confirmExpiresAt`.

### Cleanup bắt buộc

Khi intent `PENDING`, `PROCESSING` hoặc `FAILED` quá hạn:

1. Lấy `publicId` và `resourceType` đã lưu dự kiến.
2. Gọi delete Cloudinary kể cả khi asset chưa từng được confirm.
3. Cloudinary trả `not found` vẫn được coi là thành công/idempotent.
4. Chỉ sau đó mới chuyển DB thành `DELETED`.
5. Nếu provider delete lỗi, chuyển `DELETE_FAILED`, giữ đủ metadata để retry.

Thêm method batch, ví dụ:

```typescript
cleanupExpiredUploadIntents(options?: {
  batchSize?: number;
  olderThan?: Date;
}): Promise<CleanupSummary>
```

Yêu cầu:

- xử lý theo batch;
- không load toàn bộ bảng vào RAM;
- có giới hạn số item;
- trả summary: scanned, deleted, failed, skipped;
- có log có cấu trúc nhưng không log secret/signature.

Thêm script maintenance, ví dụ:

```text
backend/scripts/maintenance/cleanup-expired-media.ts
```

và package script:

```json
"maintenance:media-cleanup": "tsx scripts/maintenance/cleanup-expired-media.ts"
```

Nếu hạ tầng queue hiện tại phù hợp, có thể thêm recurring worker job, nhưng script thủ công vẫn phải tồn tại để vận hành và khắc phục sự cố.

### Tiêu chí Done

- Upload thành công lên Cloudinary nhưng không confirm vẫn bị cleanup xóa.
- Asset không tồn tại trên Cloudinary vẫn chuyển `DELETED` an toàn.
- Delete provider lỗi chuyển `DELETE_FAILED` và có thể retry.
- Metadata cũ không bị ghi đè mất khi thêm thông tin lỗi delete.

---

## 8. Sửa state machine và race condition

Sử dụng đầy đủ các trạng thái đã có:

```text
PENDING -> PROCESSING -> READY
PENDING -> FAILED
PROCESSING -> FAILED
READY -> DELETING -> DELETED
DELETE_FAILED -> DELETING -> DELETED
DELETING -> DELETE_FAILED
```

`UPLOADED` chỉ giữ nếu có event thực tế dùng trạng thái này. Nếu dùng webhook upload để ghi nhận trước confirm thì có thể dùng `UPLOADED`; nếu không, phải ghi tài liệu rõ vì sao chưa dùng. Không tạo transition giả chỉ để “dùng đủ enum”.

### Confirm

Không làm theo pattern không nguyên tử:

```text
findUnique -> check PENDING -> gọi provider -> update READY
```

Hãy claim intent bằng conditional update/transaction:

```typescript
updateMany({
  where: { id, status: PENDING },
  data: { status: PROCESSING },
})
```

- `count === 1`: request hiện tại được quyền xử lý;
- nếu đã `READY`: trả asset hiện có;
- nếu đang `PROCESSING`: trả conflict hoặc kết quả idempotent theo chính sách đã định;
- trạng thái khác: `InvalidStateTransitionException`.

Nếu xác minh/chuyển đổi thất bại:

- cập nhật `FAILED`;
- lưu error code ngắn gọn, thời gian và provider operation vào metadata;
- không lưu secret hoặc toàn bộ response nhạy cảm.

### Delete

Trước khi gọi provider, chuyển nguyên tử:

```text
READY hoặc DELETE_FAILED -> DELETING
```

Sau đó:

- provider delete thành công/not found -> `DELETED`;
- provider lỗi -> `DELETE_FAILED`.

Hai request delete đồng thời không được gọi provider hai lần một cách không kiểm soát.

### Tiêu chí Done

- Hai confirm đồng thời chỉ một request gọi Cloudinary authoritative lookup.
- Confirm lặp sau khi `READY` trả cùng asset, không tạo lỗi.
- Hai delete đồng thời không làm state quay ngược.
- Mọi transition sai dùng exception conflict phù hợp.

---

## 9. Thay generic `Error` bằng exception chuẩn

Không để các lỗi dự kiến trong media module dùng `throw new Error(...)`.

Dùng các exception có sẵn trong `src/common/exceptions`, ví dụ:

| Trường hợp | Exception đề xuất |
|---|---|
| Intent không tồn tại | `ResourceNotFoundException` |
| Intent không thuộc user | `AccessDeniedException` |
| Intent hết hạn | `ResourceGoneException` |
| Sai trạng thái | `InvalidStateTransitionException` |
| File quá lớn | `PayloadTooLargeException` |
| MIME/format không hỗ trợ | `UnsupportedMediaTypeException` |
| Input/public ID sai | `InvalidInputException` hoặc `ValidationException` |
| Cloudinary tắt | `ServiceUnavailableException` |
| Cloudinary API lỗi | `StorageException` với `cause`, operation và retryable |
| Signature response sai | exception xác thực/input phù hợp, không trả secret |
| Webhook signature sai | unauthorized/invalid input phù hợp |

Bọc lỗi từ Cloudinary SDK tại adapter boundary thành `StorageException`. Không để object lỗi SDK đi thẳng ra controller.

Bổ sung mã lỗi media ổn định, ví dụ:

```text
MEDIA_STORAGE_DISABLED
MEDIA_UPLOAD_INTENT_NOT_FOUND
MEDIA_UPLOAD_INTENT_EXPIRED
MEDIA_UPLOAD_CONFIRMATION_INVALID
MEDIA_ASSET_POLICY_VIOLATION
MEDIA_DELETE_FAILED
CLOUDINARY_WEBHOOK_SIGNATURE_INVALID
```

Các code nên được đặt trong enum/constant theo convention chung của dự án.

---

# PHẦN B — API END-TO-END

## 10. Tạo DTO và MediaController

Tạo tối thiểu:

```text
backend/src/infrastructure/media/dto/create-media-upload-intent.dto.ts
backend/src/infrastructure/media/dto/confirm-media-upload.dto.ts
backend/src/infrastructure/media/media.controller.ts
```

### Endpoint 1 — tạo upload intent

```http
POST /media/upload-intents
Authorization: Bearer <access-token>
```

Body:

```json
{
  "purpose": "STORY_COVER",
  "ownerId": "uuid",
  "originalName": "cover.webp",
  "declaredMimeType": "image/webp",
  "declaredSizeBytes": 123456,
  "metadata": {}
}
```

Validation tối thiểu:

- `purpose`: enum;
- `ownerId`: UUID;
- `originalName`: string có giới hạn độ dài;
- `declaredMimeType`: MIME hợp lệ và nằm trong policy;
- `declaredSizeBytes`: integer dương và không vượt policy;
- metadata giới hạn kích thước/độ sâu, hoặc tạm không nhận metadata từ public API nếu chưa cần.

`uploaderId` phải lấy từ:

```typescript
@CurrentUser('userId')
```

không nhận từ body.

Response phải gồm dữ liệu frontend cần gửi tới Cloudinary:

- `mediaAssetId`;
- `uploadUrl`;
- `apiKey`;
- `timestamp`;
- `signature`;
- `resourceType`;
- `confirmExpiresAt`;
- signed parameters.

Không trả API secret.

### Endpoint 2 — confirm upload

```http
POST /media/upload-intents/:mediaAssetId/confirm
Authorization: Bearer <access-token>
```

Body:

```json
{
  "publicId": "uuid-or-uuid.pdf",
  "version": 1234567890,
  "signature": "cloudinary-response-signature",
  "resourceType": "image"
}
```

Không cần lặp `mediaAssetId` trong body. Lấy từ route param và validate UUID.

Response trả media asset đã chuẩn hóa hoặc response DTO, không trả metadata nội bộ nhạy cảm.

### Endpoint 3 — đọc media

```http
GET /media/:mediaAssetId
```

- Chỉ trả asset phù hợp quyền truy cập.
- Không tự mặc định raw thành image.
- Image/video có thể trả delivery URL theo preset được whitelist.
- Raw trả `secureUrl` hoặc URL delivery raw hợp lệ; không gửi vào image transformation service.

### Endpoint 4 — xóa media

```http
DELETE /media/:mediaAssetId
Authorization: Bearer <access-token>
```

- Chỉ uploader hoặc người có permission quản trị phù hợp được xóa.
- Chưa có permission cụ thể thì tạo policy/service authorization rõ ràng; không tin `ownerId` từ client.

### Quyền sở hữu tối thiểu

- `AVATAR`: `ownerId` bắt buộc bằng `currentUser.userId`.
- `AUTHOR_BANNER`: `ownerId` phải khớp author profile của principal.
- `STORY_COVER` và `CHAPTER_IMAGE`: phải xác minh user là owner/contributor có quyền chỉnh sửa đối tượng tương ứng trước khi cấp intent.
- `ATTACHMENT`: phải có context nghiệp vụ rõ ràng; không cho upload raw tùy ý chỉ vì đã đăng nhập.

Nếu module story/chapter chưa đủ để xác minh, tạo một `MediaOwnershipAuthorizationPort` và implementation Prisma tối thiểu. Không bỏ qua authorization và không để TODO làm lỗ hổng public.

### Webhook public route

Thêm `@Public()` cho webhook vì global JWT guard đã tồn tại. Webhook chỉ tin request sau khi xác minh Cloudinary signature.

---

## 11. Xác thực file ở ba lớp

### Lớp 1 — trước khi tạo intent

`validateDeclaredFile()` phải kiểm tra:

- size > 0;
- size <= maxBytes;
- MIME nằm trong whitelist;
- extension nằm trong whitelist;
- MIME và extension có cặp hợp lệ;
- tên file không có path traversal/null byte;
- owner ID hợp lệ và đã authorization.

### Lớp 2 — upload preset trên Cloudinary

Tạo tài liệu cấu hình preset, ví dụ:

```text
backend/docs/infrastructure/CLOUDINARY_SETUP.md
```

Với từng preset phải mô tả:

- signed preset;
- `overwrite=false`;
- allowed formats;
- max file size;
- resource type;
- incoming transformation/size limit phù hợp;
- folder mode được hỗ trợ;
- không cho client tùy ý override các tham số bảo mật.

Module đang dùng `asset_folder`, vì vậy tài liệu phải yêu cầu Cloudinary **Dynamic Folder Mode**. Nếu muốn hỗ trợ legacy mode thì thêm config và test riêng; không trộn hai mode ngầm.

### Lớp 3 — sau upload

Dữ liệu authoritative lấy từ Cloudinary Admin API phải được kiểm tra lại:

- provider asset ID có tồn tại;
- public ID đúng với intent;
- resource type đúng;
- delivery type đúng chính sách;
- format đúng whitelist;
- bytes không vượt max;
- image width/height hợp lý nếu policy có giới hạn;
- asset folder đúng folder đã ký;
- version là số hợp lệ;
- secure URL dùng HTTPS;
- original filename không được dùng làm nguồn tin xác thực.

Nếu authoritative validation thất bại, chuyển `FAILED` và schedule cleanup asset.

---

# PHẦN C — WEBHOOK

## 12. Không được để webhook “nhận rồi bỏ”

`CloudinaryWebhookService.processIdempotently()` hiện đang rỗng. Phải triển khai persistence trước khi trả HTTP 200.

### Thêm inbox model trong Prisma

Ưu tiên model generic để sau này dùng cho provider khác, ví dụ:

```prisma
model InboundWebhookEvent {
  id             String   @id @default(uuid()) @db.Uuid
  provider       String   @db.VarChar(50)
  eventKey       String   @map("event_key") @db.VarChar(255)
  payloadHash    String   @map("payload_hash") @db.VarChar(64)
  eventType      String?  @map("event_type") @db.VarChar(120)
  status         String   @default("pending") @db.VarChar(30)
  payload        Json
  receivedAt     DateTime @default(now()) @map("received_at") @db.Timestamptz(3)
  processedAt    DateTime? @map("processed_at") @db.Timestamptz(3)
  attempts       Int      @default(0)
  lastError      String?  @map("last_error") @db.Text

  @@unique([provider, eventKey])
  @@index([provider, status, receivedAt])
  @@map("inbound_webhook_events")
}
```

Có thể điều chỉnh tên/type theo convention dự án, nhưng phải có unique idempotency key và payload lưu bền vững.

### Event key

Ưu tiên ID do Cloudinary gửi nếu payload có trường ổn định. Nếu không có, tính:

```text
SHA-256(rawBody)
```

và dùng làm event key/hash. Không dùng timestamp một mình.

### Luồng xử lý

```text
Nhận raw body
  -> kiểm tra timestamp hợp lệ
  -> verify Cloudinary signature
  -> parse JSON có validation
  -> insert inbox event bằng unique key
  -> nếu duplicate: trả 200 idempotent
  -> commit thành công
  -> trả 200
  -> worker/process service xử lý event
```

Không trả 200 nếu chưa lưu được event. Khi DB lỗi tạm thời, trả lỗi để Cloudinary có cơ hội retry.

### Event processing tối thiểu

Xử lý hoặc ghi nhận rõ các event liên quan đến:

- upload thành công;
- eager/transformation hoàn tất nếu dùng;
- moderation/analysis nếu dùng;
- deletion nếu Cloudinary phát event tương ứng.

Không tự chuyển asset thành `READY` chỉ dựa vào payload webhook chưa được đối chiếu với intent/policy. Webhook có thể chuyển `PENDING` sang `UPLOADED`, sau đó confirm hoặc worker authoritative verification mới chuyển `READY`.

### Validation webhook

- Thiếu header -> exception 400/401 phù hợp.
- Timestamp không phải số -> từ chối.
- Timestamp quá cũ -> từ chối.
- Signature sai -> từ chối.
- JSON invalid -> 400.
- Duplicate event -> 200 và không xử lý lặp.
- Log request ID/event key, không log signature đầy đủ.

---

# PHẦN D — QUERY VÀ DELIVERY URL

## 13. Sửa `MediaQueryService`

Không được dùng logic:

```typescript
raw -> image
```

Quy tắc:

- `IMAGE`: cho phép các image preset hợp lệ.
- `VIDEO`: chỉ cho preset/URL phù hợp video; hiện chưa có video purpose thì có thể trả URL gốc hoặc từ chối preset ảnh.
- `RAW`: không gọi `CloudinaryUrlService` với image transformation; trả secure URL đã lưu hoặc build URL raw riêng.
- Chỉ asset `READY` mới được delivery mặc định.
- Asset `DELETED`, `FAILED`, `PENDING`, `PROCESSING` không trả URL public.

Tạo response DTO thay vì trả thẳng toàn bộ Prisma entity nếu endpoint public.

---

# PHẦN E — PRISMA VÀ MIGRATION

## 14. Commit migration thực tế

Trong root `.gitignore`, xóa dòng:

```gitignore
backend/prisma/migrations/**/*.sql
```

Migration SQL phải được commit vào repository.

Tạo migration cho:

- các field media còn thiếu nếu database hiện tại chưa có;
- inbox webhook model;
- index/unique cần thiết;
- thay đổi enum/model nếu có.

Dùng command theo project:

```bash
npm run db:migrate -- --name harden_cloudinary_media
```

Sau đó kiểm tra:

```bash
npm run db:migrate:deploy
```

Migration phải chạy được trên database rỗng và database đang có schema trước đó. Không sửa tay migration cũ đã được áp dụng ở môi trường khác; tạo migration mới.

Nếu `manual-constraints.sql` liên quan, cập nhật script verify tương ứng.

---

# PHẦN F — TEST BẮT BUỘC

## 15. Unit test

Tạo test tối thiểu cho:

### Config/module

1. Cloudinary disabled vẫn bootstrap module.
2. Cloudinary enabled nhưng thiếu credential/preset thì validation fail rõ ràng.
3. Token `MEDIA_STORAGE` chọn đúng adapter.

### Public ID/policy

4. Image public ID không có extension.
5. Raw public ID có extension lowercase hợp lệ.
6. MIME sai bị từ chối.
7. Extension sai bị từ chối.
8. MIME-extension mismatch bị từ chối.
9. File size 0 và vượt max bị từ chối.
10. Tên file path traversal bị từ chối.

### Signature

11. Signed parameters chứa đúng timestamp, preset, public ID, asset folder, overwrite và tags.
12. API secret không xuất hiện trong response.
13. Response signature sai bị từ chối bằng timing-safe comparison.

### Confirm

14. Intent không tồn tại -> 404.
15. Intent không thuộc user -> 403.
16. Intent hết hạn -> 410/409 theo exception đã chọn.
17. Confirm hợp lệ -> `READY` và lưu authoritative fields.
18. Authoritative public ID/resource type/format/size/folder sai -> `FAILED`.
19. Confirm lặp sau `READY` idempotent.
20. Hai confirm cạnh tranh chỉ một request claim được `PROCESSING`.

### Delete/cleanup

21. Delete provider `ok` -> `DELETED`.
22. Delete provider `not found` -> `DELETED`.
23. Delete provider lỗi -> `DELETE_FAILED`.
24. Cleanup unconfirmed upload dùng expected public ID đã lưu.
25. Metadata cũ được merge, không bị mất khi ghi lỗi delete.

### Webhook

26. Thiếu headers bị từ chối.
27. Timestamp invalid/stale bị từ chối.
28. Signature sai bị từ chối.
29. Payload invalid JSON bị từ chối.
30. Event mới được lưu inbox trước khi trả thành công.
31. Event duplicate không tạo hai row và không xử lý hai lần.

### Query URL

32. Raw asset không bị build như image.
33. Non-READY asset không trả delivery URL.
34. Preset không phù hợp resource type bị từ chối.

---

## 16. Integration/e2e test

Tạo e2e test với Cloudinary adapter mock/fake, không gọi tài khoản Cloudinary thật trong CI mặc định.

Luồng bắt buộc:

1. User đăng nhập hoặc mock principal hợp lệ.
2. `POST /media/upload-intents` tạo row `PENDING` có expected public ID/folder.
3. Mock Cloudinary upload response và authoritative resource.
4. `POST /media/upload-intents/:id/confirm` chuyển sang `READY`.
5. `GET /media/:id` trả response đúng.
6. `DELETE /media/:id` chuyển `DELETED`.
7. Cloudinary disabled trả 503 cho media operation nhưng `/health/live` vẫn hoạt động.
8. Webhook duplicate trả 200 và chỉ có một inbox record.

Có thể thêm một integration test thật với Cloudinary sandbox bằng env riêng, nhưng phải skip mặc định và không để credential trong repo.

---

# PHẦN G — TÀI LIỆU VÀ VẬN HÀNH

## 17. Tạo tài liệu Cloudinary setup

Tạo:

```text
backend/docs/infrastructure/CLOUDINARY_SETUP.md
```

Nội dung tối thiểu:

- kiến trúc direct signed upload;
- sequence tạo intent -> upload -> confirm;
- ý nghĩa `confirmExpiresAt`;
- cảnh báo signed request có thể vẫn được Cloudinary chấp nhận sau thời hạn confirm của app;
- danh sách env;
- cách tạo từng upload preset;
- yêu cầu Dynamic Folder Mode;
- whitelist format/MIME/size;
- webhook URL và cách cấu hình notification;
- cách rotate API secret;
- cách chạy cleanup;
- cách retry `DELETE_FAILED`;
- cách kiểm tra orphan assets;
- cách chạy test sandbox;
- không bao giờ đưa API secret ra frontend.

Cập nhật `backend/README.md` hoặc infrastructure documentation để link tới file trên.

---

## 18. Script kiểm tra Cloudinary config

Thêm script, ví dụ:

```text
backend/scripts/ci/verify-cloudinary-config.ts
```

Package script:

```json
"ci:verify-cloudinary": "tsx scripts/ci/verify-cloudinary-config.ts"
```

Khi `CLOUDINARY_ENABLED=false`, script có thể skip thành công với message rõ ràng.

Khi enabled, script phải kiểm tra tối thiểu:

- credential gọi được API;
- các upload preset tồn tại;
- preset đúng signed mode;
- resource type/format/size policy không mâu thuẫn với code;
- không in API secret.

Nếu Cloudinary Admin API không cho kiểm tra một thuộc tính cụ thể, ghi cảnh báo và tài liệu bước kiểm tra thủ công; không giả vờ đã verify.

---

# PHẦN H — CHẤT LƯỢNG CODE

## 19. Type safety

- Tạo type alias chung cho resource type thay vì lặp union string ở nhiều file.
- Mapper từ Cloudinary phải validate các field bắt buộc trước khi cast.
- Không dùng:

```typescript
stored.resourceType.toUpperCase() as any
```

Tạo mapper rõ ràng:

```typescript
function toPrismaMediaResourceType(
  value: StorageResourceType,
): MediaResourceType
```

- Xử lý `asset.format` có thể undefined với raw asset.
- Xử lý `asset.secure_url`, `asset_id`, `public_id`, `version`, `bytes` thiếu bằng `StorageException`/mapping exception.
- `duration` phải map đúng kiểu Decimal/number theo Prisma.

---

## 20. Logging và observability

Log có cấu trúc cho các event:

- upload intent created;
- upload confirmed;
- authoritative validation failed;
- cleanup attempted/succeeded/failed;
- webhook accepted/duplicate/rejected;
- delete attempted/succeeded/failed.

Log field được phép:

```text
mediaAssetId
publicId đã mask nếu cần
purpose
resourceType
operation
status
requestId/correlationId
eventKey
retryable
```

Không log:

```text
apiSecret
full signature
credential URL
raw authorization header
full webhook payload nếu có dữ liệu nhạy cảm
```

Nếu project đã có logger/interceptor/request context thì tái sử dụng, không tạo logger framework mới.

---

# PHẦN I — THỨ TỰ THỰC HIỆN

Codex phải làm theo thứ tự để tránh code nửa vời:

1. Sửa optional module/provider để app bootstrap khi disabled.
2. Hoàn thiện config và policy attachment.
3. Chuẩn hóa public ID/folder và lưu expected fields ở `PENDING`.
4. Sửa DTO/contracts/type mapper.
5. Sửa MediaService confirm state machine và exception.
6. Sửa delete/cleanup orphan asset.
7. Thêm MediaController và authorization policy.
8. Sửa MediaQueryService cho raw/image/video.
9. Thêm webhook inbox/idempotency và migration.
10. Thêm maintenance/config verification scripts.
11. Viết unit test và e2e test.
12. Cập nhật tài liệu.
13. Chạy toàn bộ quality gate và sửa sạch lỗi.

Không triển khai webhook trước khi migration/inbox model đã rõ. Không thêm controller trước khi authorization và validation đầu vào đã có.

---

# PHẦN J — QUALITY GATE

## 21. Các lệnh bắt buộc phải chạy

Trong thư mục `backend`:

```bash
npm ci
npm run build
npm run lint
npm run typecheck:scripts
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Với database test/local đã sẵn sàng:

```bash
npm run db:migrate:deploy
npm run db:check
npm run db:verify:constraints
```

Khi Cloudinary disabled:

```bash
CLOUDINARY_ENABLED=false npm run build
CLOUDINARY_ENABLED=false npm test -- --runInBand
```

Khi có sandbox credential:

```bash
npm run ci:verify-cloudinary
```

Nếu lint script đang dùng `--fix`, sau khi chạy phải kiểm tra git diff để chắc chắn không có sửa format ngoài phạm vi không mong muốn.

---

## 22. Definition of Done

Chỉ được báo hoàn thành khi tất cả điều sau đúng:

- [ ] App và worker khởi động được khi Cloudinary disabled.
- [ ] Media operation khi disabled trả lỗi có cấu trúc, không crash bootstrap.
- [ ] Có đủ config/preset cho avatar, author banner, story cover, chapter image và attachment.
- [ ] Raw attachment dùng public ID có extension đã validate.
- [ ] Expected public ID/resource type/folder được lưu từ lúc `PENDING`.
- [ ] Upload intent API và confirm API dùng được end-to-end.
- [ ] User không thể giả uploader ID từ body.
- [ ] Owner authorization được kiểm tra theo purpose.
- [ ] Confirm chống race condition và idempotent sau `READY`.
- [ ] Delete có `DELETING`, retry được từ `DELETE_FAILED`.
- [ ] Cleanup xóa được unconfirmed/orphan Cloudinary asset.
- [ ] Webhook được verify, persist và deduplicate trước khi trả 200.
- [ ] Raw asset không bị xử lý như image.
- [ ] Không còn generic `Error` cho các lỗi media dự kiến.
- [ ] Không còn `as any` ở phần mapping media resource type.
- [ ] Prisma migration SQL được commit và không còn bị `.gitignore` bỏ qua.
- [ ] Có unit test và e2e test theo danh sách tối thiểu.
- [ ] Có `CLOUDINARY_SETUP.md` và `.env.example` đầy đủ.
- [ ] Build, lint, typecheck, test và migration đều pass.
- [ ] Không có credential/secret trong source, log, fixture hoặc commit.

---

# PHẦN K — ĐẦU RA CODEX PHẢI BÁO CÁO

Sau khi sửa, Codex phải trả báo cáo theo mẫu:

```markdown
## Files changed
- đường dẫn file: mô tả ngắn

## Architecture decisions
- cách làm Cloudinary optional
- cách tạo public ID raw/image
- state machine confirm/delete
- cách webhook idempotency hoạt động
- cách authorization owner hoạt động

## Database changes
- tên migration
- model/index/constraint mới

## API changes
- method + route
- request/response chính
- auth/permission

## Tests added
- danh sách test suite
- số test pass/fail

## Commands executed
- command
- kết quả

## Remaining limitations
- chỉ ghi các giới hạn có thật; không để TODO bảo mật hoặc blocker production
```

Nếu có lệnh không chạy được do môi trường ngoài code, phải ghi chính xác lỗi, phần nào đã kiểm tra thay thế và tuyệt đối không tuyên bố “all tests pass”.

---

## 23. Gợi ý cấu trúc file sau khi hoàn thiện

Codex có thể điều chỉnh tên theo convention, nhưng module nên gần cấu trúc sau:

```text
src/infrastructure/media/
├── adapters/
│   └── disabled-media-storage.adapter.ts
├── application/
│   ├── media-cleanup.service.ts
│   ├── media-ownership-authorization.service.ts
│   ├── media-query.service.ts
│   └── media.service.ts
├── cloudinary/
│   ├── cloudinary-media.adapter.ts
│   ├── cloudinary-response.mapper.ts
│   ├── cloudinary-signature.service.ts
│   ├── cloudinary-url.service.ts
│   ├── cloudinary-webhook.controller.ts
│   ├── cloudinary-webhook.service.ts
│   ├── cloudinary.constants.ts
│   └── cloudinary.provider.ts
├── contracts/
│   ├── media-ownership-authorization.port.ts
│   ├── media-storage.port.ts
│   ├── signed-upload.interface.ts
│   └── stored-media.interface.ts
├── dto/
│   ├── confirm-media-upload.dto.ts
│   ├── create-media-upload-intent.dto.ts
│   └── media-response.dto.ts
├── policies/
│   ├── media-public-id.service.ts
│   └── media-upload-policy.registry.ts
├── media.controller.ts
├── media.module.ts
└── index.ts
```

Không bắt buộc tạo mọi abstraction nếu không mang lại giá trị, nhưng mọi yêu cầu bảo mật, state, cleanup, webhook và test trong tài liệu này vẫn bắt buộc.

---

## 24. Ưu tiên khi có xung đột

Nếu một yêu cầu kỹ thuật xung đột với code hiện tại, ưu tiên theo thứ tự:

1. Không lộ secret và không có lỗ hổng authorization.
2. Dữ liệu DB và Cloudinary không bị lệch hoặc để orphan lâu dài.
3. App không crash khi feature optional bị tắt.
4. State transition nguyên tử và idempotency.
5. Type safety và exception chuẩn.
6. Tương thích API.
7. Tối ưu hiệu năng và cleanup code.

Không hy sinh bảo mật hoặc tính đúng đắn chỉ để giữ nguyên vài dòng API chưa có frontend sử dụng.
