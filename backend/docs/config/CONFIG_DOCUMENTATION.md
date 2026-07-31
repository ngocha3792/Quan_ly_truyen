# CONFIGURATION DOCUMENTATION

> Dự án: **Quản lý truyện — Backend NestJS**  
> Phạm vi: `backend/src/config` và các file `.env*`  
> Mục tiêu: tạo một nguồn cấu hình tập trung, có kiểu dữ liệu, được kiểm tra khi khởi động và không làm rò rỉ bí mật.

---

## 1. Mục đích của tài liệu

Tài liệu này mô tả:

- `backend/src/config` nên chứa những gì;
- `.env` và `.env.example` nên chứa những biến nào;
- biến nào đang cần cho mã nguồn hiện tại;
- biến nào chỉ nên thêm khi module tương ứng được triển khai;
- cách phân chia trách nhiệm giữa config, constants, bootstrap và module nghiệp vụ;
- quy tắc bảo mật đối với secret;
- cách truy cập cấu hình trong NestJS mà không đọc `process.env` rải rác.

Tài liệu triển khai chi tiết nằm trong:

```text
CONFIG_IMPLEMENTATION_GUIDE.md
```

---

## 2. Hiện trạng của dự án

Trong mã nguồn hiện tại, cấu hình môi trường đang được đọc trực tiếp tại các vị trí sau:

| Biến | Vị trí đang sử dụng | Mục đích |
|---|---|---|
| `DATABASE_URL` | `prisma.config.ts`, `prisma/seed.ts` | Kết nối PostgreSQL |
| `PORT` | `src/main.ts` | Cổng HTTP |
| `MAINTENANCE_MODE` | `src/app.module.ts` | Bật/tắt chế độ bảo trì |
| `MAINTENANCE_BYPASS_TOKEN` | `src/app.module.ts` | Cho phép request nội bộ vượt qua maintenance mode |

Các vấn đề hiện tại:

1. Chưa có `@nestjs/config` và chưa có `ConfigModule`.
2. `process.env` được đọc trực tiếp trong `main.ts` và `AppModule`.
3. Không có bước kiểm tra biến môi trường trước khi ứng dụng khởi động.
4. Giá trị boolean và number chưa được parse/validate tập trung.
5. `docs/.env.example` chỉ có `DATABASE_URL`.
6. Giá trị `DATABASE_URL` trong file mẫu hiện tại trông giống thông tin đăng nhập thật.

> **Hành động bảo mật bắt buộc:** không tiếp tục sử dụng credential xuất hiện trong file mẫu hiện tại. Hãy thu hồi hoặc rotate mật khẩu/token tại nhà cung cấp database, rồi thay toàn bộ file mẫu bằng placeholder.

---

## 3. Nguyên tắc kiến trúc

### 3.1. Một nguồn sự thật duy nhất

Luồng cấu hình chuẩn:

```text
Environment variables / secret manager
                │
                ▼
       environment.validation.ts
                │
                ▼
        ConfigModule.forRoot()
                │
                ▼
       namespaced config files
                │
                ▼
             ConfigService
                │
                ▼
 bootstrap / infrastructure / feature modules
```

Mã nghiệp vụ không nên đọc `process.env` trực tiếp.

### 3.2. Fail fast

Nếu thiếu secret bắt buộc hoặc giá trị sai định dạng, ứng dụng phải dừng ngay khi khởi động.

Không được để ứng dụng chạy rồi chỉ phát hiện lỗi khi request đầu tiên tới.

### 3.3. Cấu hình có kiểu dữ liệu

Các biến môi trường đều là chuỗi tại runtime. Config layer phải chuyển chúng thành kiểu thích hợp:

- `PORT` → `number`;
- `MAINTENANCE_MODE` → `boolean`;
- `CORS_ALLOWED_ORIGINS` → `string[]`;
- `HTTP_REQUEST_TIMEOUT_MS` → `number`;
- `COOKIE_SECURE` → `boolean`.

### 3.4. Secret không có default nguy hiểm

Các secret sau không được có default production:

- `DATABASE_URL`;
- JWT secrets;
- maintenance bypass token;
- OAuth client secrets;
- SMTP password;
- storage secret keys;
- observability ingestion tokens.

### 3.5. Constants và config là hai khái niệm khác nhau

**Constants** là giá trị ổn định trong mã nguồn:

```ts
export const APP_NAME = 'quan-ly-truyen';
export const API_GLOBAL_PREFIX = 'api';
export const API_VERSION = 'v1';
```

**Config** là giá trị thay đổi theo môi trường:

```text
PORT=3000
DATABASE_URL=...
CORS_ALLOWED_ORIGINS=http://localhost:4200
JWT_ACCESS_SECRET=...
```

Không chuyển tất cả constants sang `.env`. Các giá trị không có lý do thay đổi giữa deployment nên tiếp tục nằm trong `src/common/constants` hoặc module sở hữu chúng.

---

## 4. Cấu trúc `backend/src/config` đề xuất

```text
backend/src/config/
├── app.config.ts
├── auth.config.ts
├── cors.config.ts
├── database.config.ts
├── environment.validation.ts
├── maintenance.config.ts
├── upload.config.ts
├── config.module.ts
├── config.types.ts
└── index.ts
```

Khi các hạ tầng tương ứng được triển khai, có thể bổ sung:

```text
backend/src/config/
├── cache.config.ts
├── mail.config.ts
├── observability.config.ts
├── oauth.config.ts
├── queue.config.ts
├── rate-limit.config.ts
└── storage.config.ts
```

Không nên tạo tất cả file tương lai ngay nếu chưa có consumer. Chỉ tạo khi module thực sự bắt đầu sử dụng cấu hình đó.

---

## 5. Trách nhiệm từng file

### 5.1. `environment.validation.ts`

Đây là biên bảo vệ đầu tiên của ứng dụng.

Nhiệm vụ:

- chuẩn hóa `NODE_ENV`;
- parse boolean, integer, danh sách phân tách bằng dấu phẩy;
- kiểm tra biến bắt buộc;
- kiểm tra URL;
- kiểm tra range của port, timeout, bcrypt rounds;
- ngăn dùng secret yếu trong staging/production;
- trả lại object đã chuẩn hóa cho `ConfigModule`.

File này không nên chứa business logic.

### 5.2. `app.config.ts`

Chứa cấu hình HTTP/application chung:

- environment;
- host;
- port;
- public URL;
- trust proxy;
- request body limits;
- request timeout;
- Swagger enable/disable;
- locale mặc định và locale hỗ trợ.

### 5.3. `database.config.ts`

Chứa cấu hình database:

- `DATABASE_URL`;
- connection timeout;
- query timeout;
- transaction timeout;
- pool size nếu adapter/provider hỗ trợ.

Trong giai đoạn hiện tại, chỉ `url` là bắt buộc.

### 5.4. `cors.config.ts`

Chứa:

- danh sách origin được phép;
- credentials;
- methods;
- allowed headers;
- exposed headers;
- preflight max age.

Không dùng `origin: '*'` cùng `credentials: true`.

### 5.5. `maintenance.config.ts`

Chứa:

- bật/tắt maintenance mode;
- thông báo bảo trì;
- retry-after;
- bypass header name;
- bypass token;
- các path vẫn hoạt động trong thời gian bảo trì.

### 5.6. `auth.config.ts`

Chỉ cần tạo khi auth module bắt đầu được triển khai.

Chứa:

- access-token secret và TTL;
- refresh-token secret và TTL;
- issuer và audience;
- bcrypt rounds;
- cookie flags;
- session lifetime;
- giới hạn số phiên hoạt động.

Không trả secret ra controller hoặc API response.

### 5.7. `upload.config.ts`

Chứa giới hạn thay đổi theo môi trường:

- maximum upload bytes;
- maximum image bytes;
- temporary upload directory;
- public media URL nếu có.

MIME types và extensions ổn định nên tiếp tục nằm ở constants.

### 5.8. `config.types.ts`

Định nghĩa interface cho từng namespace và root config.

Mục tiêu:

- autocomplete;
- tránh viết sai key;
- dễ mock config trong test;
- tránh truyền object không rõ cấu trúc giữa các module.

### 5.9. `config.module.ts`

Module cấu hình toàn cục của ứng dụng.

Nhiệm vụ:

- gọi `ConfigModule.forRoot()`;
- khai báo danh sách file env được phép load;
- gọi hàm validate;
- load các namespace config;
- bật cache cho env lookup;
- quyết định có bỏ qua `.env` trong production hay không.

### 5.10. `index.ts`

Chỉ export public API của folder config.

Không nên export helper nội bộ không cần dùng bên ngoài.

---

## 6. Nhóm biến môi trường

### 6.1. Nhóm bắt buộc hiện tại

Đây là nhóm tối thiểu để chạy backend hiện tại sau khi refactor config:

```dotenv
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quan_ly_truyen?schema=public

CORS_ALLOWED_ORIGINS=http://localhost:4200

MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE=Hệ thống đang bảo trì
MAINTENANCE_RETRY_AFTER_SECONDS=300
MAINTENANCE_BYPASS_HEADER=x-maintenance-key
MAINTENANCE_BYPASS_TOKEN=

HTTP_REQUEST_TIMEOUT_MS=15000
TRUST_PROXY=false
DEFAULT_LOCALE=vi-VN
SUPPORTED_LOCALES=vi-VN,en-US
```

### 6.2. Nhóm bootstrap/HTTP khuyến nghị

```dotenv
APP_PUBLIC_URL=http://localhost:3000
JSON_BODY_LIMIT=2mb
URL_ENCODED_BODY_LIMIT=2mb
SWAGGER_ENABLED=true
```

`SWAGGER_ENABLED` chỉ có tác dụng sau khi Swagger được triển khai.

### 6.3. Nhóm auth — chỉ thêm khi triển khai auth

```dotenv
JWT_ISSUER=quan-ly-truyen
JWT_AUDIENCE=quan-ly-truyen-web
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_REFRESH_TTL_SECONDS=2592000
BCRYPT_ROUNDS=12

AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
AUTH_MAX_ACTIVE_SESSIONS=10
```

Quy tắc:

- access secret và refresh secret phải khác nhau;
- production secret phải đủ dài và sinh ngẫu nhiên;
- không commit secret vào Git;
- cookie secure phải bật khi chạy HTTPS production.

### 6.4. OAuth — chỉ thêm provider đã triển khai

Ví dụ Google:

```dotenv
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

Không thêm biến Facebook/GitHub chỉ vì enum đã có trong Prisma schema. Chỉ thêm khi strategy/provider tương ứng tồn tại.

### 6.5. Mail — chỉ thêm khi có email service

```dotenv
MAIL_ENABLED=false
MAIL_FROM_NAME=Quan ly truyen
MAIL_FROM_ADDRESS=no-reply@example.com
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

Các luồng dự kiến sử dụng mail:

- xác minh email;
- quên mật khẩu;
- thay đổi email;
- thông báo hệ thống.

### 6.6. Storage/media — chỉ thêm khi có storage adapter

```dotenv
STORAGE_PROVIDER=local
STORAGE_BUCKET=quan-ly-truyen
STORAGE_REGION=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=http://localhost:3000/media
LOCAL_STORAGE_PATH=./storage
MAX_UPLOAD_SIZE_BYTES=10485760
MAX_IMAGE_SIZE_BYTES=5242880
```

Schema hiện có `MediaAsset.storageProvider`, `bucket`, `storageKey`; vì vậy storage config sẽ cần khi media module được triển khai.

### 6.7. Redis/cache/queue — chỉ thêm khi có adapter

```dotenv
REDIS_URL=redis://localhost:6379
CACHE_DEFAULT_TTL_SECONDS=300
QUEUE_PREFIX=quan-ly-truyen
```

Không thêm Redis như dependency bắt buộc trước khi cache, distributed lock, idempotency hoặc queue được triển khai.

### 6.8. Observability — chỉ thêm khi tích hợp

```dotenv
LOG_LEVEL=debug
LOG_FORMAT=pretty
OTEL_ENABLED=false
OTEL_SERVICE_NAME=quan-ly-truyen-backend
OTEL_EXPORTER_OTLP_ENDPOINT=
SENTRY_DSN=
```

Không log giá trị secret hoặc full `DATABASE_URL`.

---

## 7. File `.env` nào nên tồn tại?

### 7.1. File được commit

```text
.env.example
.env.test.example      # tùy chọn
```

Các file này chỉ chứa placeholder và giá trị không bí mật.

### 7.2. File không được commit

```text
.env
.env.local
.env.development
.env.test
.env.staging
.env.production
.env.*.local
```

`.gitignore` hiện tại đã bỏ qua `.env` và `.env.*`, đồng thời cho phép `.env.example` và `.env.sample`. Đây là hướng đúng.

### 7.3. Production

Production nên ưu tiên biến môi trường hoặc secret manager của nền tảng triển khai thay vì copy `.env.production` lên server.

Ví dụ nguồn secret:

- Kubernetes Secret;
- Docker Secret;
- AWS Secrets Manager;
- GCP Secret Manager;
- Azure Key Vault;
- secret store của Render, Railway, Fly.io hoặc CI/CD platform.

---

## 8. `.env.example` đề xuất cho giai đoạn hiện tại

```dotenv
# ============================================================
# APPLICATION
# ============================================================
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
APP_PUBLIC_URL=http://localhost:3000
TRUST_PROXY=false

# ============================================================
# HTTP
# ============================================================
HTTP_REQUEST_TIMEOUT_MS=15000
JSON_BODY_LIMIT=2mb
URL_ENCODED_BODY_LIMIT=2mb
SWAGGER_ENABLED=true

# ============================================================
# LOCALE
# ============================================================
DEFAULT_LOCALE=vi-VN
SUPPORTED_LOCALES=vi-VN,en-US

# ============================================================
# CORS
# ============================================================
CORS_ALLOWED_ORIGINS=http://localhost:4200
CORS_CREDENTIALS=true
CORS_MAX_AGE_SECONDS=86400

# ============================================================
# DATABASE
# ============================================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quan_ly_truyen?schema=public

# ============================================================
# MAINTENANCE
# ============================================================
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE=Hệ thống đang bảo trì
MAINTENANCE_RETRY_AFTER_SECONDS=300
MAINTENANCE_BYPASS_HEADER=x-maintenance-key
MAINTENANCE_BYPASS_TOKEN=

# ============================================================
# AUTH — enable when auth module is implemented
# ============================================================
JWT_ISSUER=quan-ly-truyen
JWT_AUDIENCE=quan-ly-truyen-web
JWT_ACCESS_SECRET=change-me-with-a-long-random-value
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_SECRET=change-me-with-another-long-random-value
JWT_REFRESH_TTL_SECONDS=2592000
BCRYPT_ROUNDS=12
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
AUTH_MAX_ACTIVE_SESSIONS=10

# ============================================================
# UPLOAD / STORAGE — enable when media module is implemented
# ============================================================
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./storage
STORAGE_PUBLIC_BASE_URL=http://localhost:3000/media
MAX_UPLOAD_SIZE_BYTES=10485760
MAX_IMAGE_SIZE_BYTES=5242880
```

> Khi auth và storage chưa được import vào ứng dụng, validation không được bắt buộc các secret của chúng. Validation phải hỗ trợ cấu hình theo feature hoặc theo deployment phase.

---

## 9. Ma trận bắt buộc theo môi trường

| Biến | Development | Test | Staging | Production |
|---|---:|---:|---:|---:|
| `NODE_ENV` | Có | Có | Có | Có |
| `PORT` | Default được | Default được | Nên có | Nên có |
| `DATABASE_URL` | Bắt buộc | Bắt buộc | Bắt buộc | Bắt buộc |
| `CORS_ALLOWED_ORIGINS` | Default local được | Có thể rỗng | Bắt buộc | Bắt buộc |
| `MAINTENANCE_BYPASS_TOKEN` | Tùy chọn | Tùy chọn | Khuyến nghị | Khuyến nghị |
| JWT secrets | Khi auth bật | Khi auth bật | Bắt buộc khi auth bật | Bắt buộc khi auth bật |
| `AUTH_COOKIE_SECURE` | `false` | `false` | `true` | `true` |
| Swagger | Có thể bật | Thường tắt | Có kiểm soát | Tắt mặc định |
| `TRUST_PROXY` | Thường `false` | `false` | Tùy hạ tầng | Tùy hạ tầng |

---

## 10. Quy tắc đặt tên biến

1. Dùng uppercase snake case.
2. Tên có namespace rõ ràng: `JWT_`, `CORS_`, `MAIL_`, `STORAGE_`.
3. Ghi rõ đơn vị trong tên:
   - `_MS` cho milliseconds;
   - `_SECONDS` cho seconds;
   - `_BYTES` cho bytes.
4. Boolean dùng `true` hoặc `false`, không dùng `1`, `yes`, `on` nếu validator không hỗ trợ rõ ràng.
5. Danh sách dùng dấu phẩy và trim từng phần tử.
6. Không dùng tên mơ hồ như `TIMEOUT`, `SECRET`, `URL` không có namespace.

---

## 11. Quy tắc sử dụng trong mã nguồn

### Được phép đọc env trực tiếp

Chỉ một số entry point bên ngoài DI container có thể cần đọc env:

- `prisma.config.ts`;
- scripts chạy độc lập trước khi Nest app được tạo;
- file khởi tạo config validation.

Ngay cả tại đây cũng nên dùng helper dùng chung khi có thể.

### Không nên đọc env trực tiếp

Không dùng `process.env` trong:

- controller;
- service nghiệp vụ;
- guard;
- interceptor;
- middleware;
- repository;
- module feature.

Thay vào đó inject `ConfigService` hoặc typed config token.

### Không truyền cả `ConfigService` vào domain

Domain logic nên nhận giá trị cần thiết qua constructor/options, không phụ thuộc trực tiếp vào Nest config package.

---

## 12. Cấu hình và testing

Mỗi config namespace nên có unit test cho:

- default hợp lệ;
- parse number/boolean/list;
- thiếu required variable;
- URL sai;
- range sai;
- production secret yếu;
- hai JWT secret giống nhau;
- CORS wildcard cùng credentials;
- cookie không secure trong production.

E2E test nên khởi tạo app bằng `.env.test` hoặc object env cô lập.

Không dùng production database trong test.

---

## 13. Những lỗi cần tránh

### 13.1. Commit secret vào `.env.example`

File example là tài liệu công khai trong repository. Chỉ dùng placeholder.

### 13.2. Dùng `Boolean(process.env.X)`

```ts
Boolean('false') === true;
```

Luôn dùng parser rõ ràng.

### 13.3. Dùng `Number(value)` mà không kiểm tra

`Number('abc')` trả về `NaN`. Validator phải kiểm tra integer và range.

### 13.4. Có default cho production secret

Không dùng:

```ts
jwtSecret: process.env.JWT_SECRET ?? 'secret'
```

### 13.5. Trả toàn bộ config qua endpoint debug

Không bao giờ expose root config object. Health endpoint chỉ trả trạng thái, không trả URL hoặc secret.

### 13.6. Log raw environment

Không log `process.env`, `ConfigService` dump hoặc connection string đầy đủ.

### 13.7. Validation bắt buộc feature chưa triển khai

Nếu mail module chưa bật, không nên bắt buộc SMTP credentials. Validation phải theo feature flag hoặc theo danh sách module đang dùng.

---

## 14. Trách nhiệm giữa các tầng

| Tầng | Trách nhiệm |
|---|---|
| `.env` / secret manager | Cung cấp giá trị theo deployment |
| `environment.validation.ts` | Parse, normalize và reject config sai |
| config namespace | Tạo object cấu hình có cấu trúc |
| `ConfigModule` | Đăng ký config trong DI container |
| `bootstrap` | Áp dụng config lên Nest application |
| infrastructure module | Dùng config để tạo DB/storage/mail/cache clients |
| feature module | Nhận options cần thiết, không đọc env trực tiếp |
| constants | Giá trị ổn định không phụ thuộc environment |

---

## 15. Thứ tự triển khai khuyến nghị

### P0 — bắt buộc

- Rotate credential đã xuất hiện trong `.env.example` cũ.
- Tạo `.env.example` mới bằng placeholder.
- Cài và đăng ký `@nestjs/config`.
- Tạo env validation.
- Tạo app, database, CORS và maintenance config.
- Xóa `process.env` khỏi `main.ts` và `AppModule`.

### P1 — sau khi bootstrap được refactor

- Cho bootstrap sử dụng typed config.
- Đưa timeout, body limit, locale và trust proxy vào config.
- Viết unit test cho validation.
- Chuẩn hóa cách scripts đọc config.

### P2 — theo module

- Auth config khi triển khai auth.
- Storage config khi triển khai media.
- Mail config khi triển khai verification/password reset.
- Redis/cache/queue config khi adapter tồn tại.
- Observability config khi tích hợp logging/tracing/error reporting.

---

## 16. Definition of Done

Config layer được xem là hoàn thành khi:

- [ ] Không còn `process.env` trong `src/`, ngoại trừ file validation/entry point có chủ đích.
- [ ] Ứng dụng dừng ngay nếu thiếu `DATABASE_URL`.
- [ ] Boolean, number và list được parse đúng.
- [ ] `.env.example` không chứa credential thật.
- [ ] `AppModule` import một config module duy nhất.
- [ ] Bootstrap nhận host, port, CORS và timeout từ typed config.
- [ ] Maintenance middleware nhận options từ config.
- [ ] Test không kết nối production database.
- [ ] Secret không xuất hiện trong log hoặc API response.
- [ ] Tài liệu được cập nhật mỗi khi thêm biến môi trường mới.

---

## 17. Quy tắc cập nhật tài liệu

Mỗi pull request thêm biến env phải đồng thời:

1. thêm key vào `.env.example`;
2. thêm validation;
3. thêm typed config;
4. thêm test;
5. ghi rõ module sử dụng;
6. ghi rõ biến bắt buộc hay tùy chọn;
7. cập nhật tài liệu này.

Không chấp nhận việc chỉ thêm `process.env.NEW_KEY` trong code mà không cập nhật config contract.
