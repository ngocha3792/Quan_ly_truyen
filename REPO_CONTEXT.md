# REPO_CONTEXT — Quan-ly-truyen / TruyenHub

> Gói ngữ cảnh reconnaissance cho agent tiếp theo. Tài liệu này mô tả **những gì có trong checkout**, không phải báo cáo trạng thái của VPS hay môi trường live.

## 0. Metadata, phạm vi và quy ước độ tin cậy

- Thời điểm scan: `2026-09-07`, timezone `Asia/Bangkok`.
- Checkout: `E:\New folder\Quan-ly-truyen`.
- Git branch tại lúc scan: `main`.
- Git commit tại lúc scan: `523678ea3cce68ced23735cc24670ed556bb6aaa`.
- `AGENTS.md`: không tìm thấy trong checkout.
- Phạm vi đọc sâu: `backend/src`, `backend/prisma`, `backend/scripts`, `backend/test`, `backend/docker`, `backend/ops/production`, `backend/compose*.yml`, `frontend/src`, `frontend/e2e`, các manifest/build config, `.github/workflows`.
- Đã bỏ qua khi đọc nội dung: `node_modules`, build output, coverage/cache, binary/media, `.git` internals và payload của ba file patch ở root. Ba patch chỉ được ghi nhận là artifact hiện hữu: `phase0-production-v1-scope.patch`, `phase1-functional-blockers.patch`, `phase2-architecture-contracts.patch`.
- Prisma client được generate vào `backend/src/generated/prisma`, nhưng thư mục này không phải source tracked tại commit đã scan (`backend/prisma/schema.prisma:1-5`).

Các nhãn dùng trong tài liệu:

- **Repo evidence**: đọc trực tiếp từ code/config/test/doc trong checkout; có path và thường có symbol/line.
- **Inference**: suy luận hợp lý từ nhiều evidence, cần xác minh trước khi coi là hành vi runtime.
- **Uncertainty**: chưa đủ evidence, hoặc config/docs có thể lệch trạng thái thực tế.
- **Live gap**: không được phép suy từ repo rằng DNS, TLS, SMTP, backup, Redis, queue, container hay VPS hiện đang khỏe/đúng phiên bản.

Mức tự tin tổng thể: **cao** cho topology code, route, schema, entrypoint, CI/CD declarative và contract nội bộ; **trung bình** cho behavior end-to-end chưa chạy test; **không có kết luận** về live/VPS vì reconnaissance này không truy cập hay kiểm tra server.

---

## 1. Executive summary và mental model

Đây là một monorepo ứng dụng đọc/đăng truyện tên UI là **TruyenHub**, gồm:

1. Backend NestJS 11 + Prisma 7 + PostgreSQL, thiết kế theo module/domain và ports/adapters. API mặc định được bảo vệ bằng JWT; public endpoint phải gắn `@Public()` (`backend/src/app.module.ts:47-135`, `backend/src/common/guards/jwt-auth.guard.ts:11-31`).
2. Frontend Angular 22 standalone + SSR, dùng route-scoped providers và lazy loading. Browser gọi API same-origin dưới `/api/v1`; dev dùng Angular proxy tới backend `localhost:3000` (`frontend/proxy.conf.json:1-8`, `frontend/src/environments/environment.ts:1-17`).
3. Một process worker Nest riêng cho BullMQ/outbox/mail/notification/analytics/AI và webhook inbox; worker được bootstrap sau production config gate (`backend/src/worker.ts:1-18`, `backend/src/bootstrap/worker.bootstrap.ts:12-49`, `backend/src/worker.module.ts:16-45`).
4. Production topology declarative bằng Docker Compose: PostgreSQL, Redis, migrate, API, worker, Angular SSR, Caddy, recovery metrics và các profile gate/cleanup/backup/restore drill (`backend/compose.production.yml:47-580`).
5. GitHub Actions thực hiện quality gates, integration/E2E/security/container checks, publish immutable images và deploy qua SSH. SSH chỉ là transport/control channel; workflow `Deploy Environment` mới là cơ chế Continuous Deployment khi CI trên `main` thành công (`.github/workflows/deploy-environment.yml:1-39,42-320`).

Mental model ngắn nhất:

```text
Browser
  -> Caddy
      -> /api/* -> Nest API -> application handlers -> ports -> Prisma/Redis/Cloudinary/SMTP/AI
      -> /*     -> Angular SSR -> hydrated Angular client

Nest API transaction
  -> PostgreSQL domain row(s) + OutboxEvent/InboundWebhookEvent/ReaderAnalyticsEvent
  -> separate Nest worker claims/enqueues/processes
  -> external side effect or aggregate update
```

PostgreSQL là source of truth chính. Redis là hạ tầng hỗ trợ cho cache/lock/idempotency/rate-limit/blacklist/OAuth coordination/BullMQ; không nên coi Redis là nơi giữ dữ liệu nghiệp vụ bền vững. Các side effect quan trọng được đẩy ra ngoài request transaction qua outbox hoặc inbox thay vì gọi đồng bộ một cách tùy tiện.

Sản phẩm bao phủ: đăng ký/xác thực bảo mật cao, hồ sơ tác giả và xét duyệt đơn, author studio, truyện/chương và submission review, taxonomy, đọc truyện, thư viện/lịch sử/bookmark/mục tiêu, follow/rating/comment, moderation/report/audit, notification, reader/author analytics, media Cloudinary và AI assistant/chapter translation.

---

## 2. Bản đồ repo và thứ tự đọc mặc định

Không cần đọc toàn bộ tree. Các vùng có vai trò rõ:

| Vùng | Vai trò | Điểm bắt đầu |
|---|---|---|
| `backend/src` | Nest API, worker, modules, infrastructure | `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/worker.module.ts` |
| `backend/src/modules/<domain>` | Vertical slice theo domain | `<domain>.module.ts`, `presentation/http/controllers`, `application`, `domain`, `infrastructure` |
| `backend/src/common` | guards/decorators/filter/interceptor/validation/shared enums | `common-guards.module.ts`, `common-interceptors.module.ts`, `all-exceptions.filter.ts` |
| `backend/src/infrastructure` | Prisma, Redis, queue, outbox, mail, health, observability | `infrastructure.module.ts` và module con |
| `backend/prisma` | schema, migrations, seeds | `schema.prisma`, `seed.ts`, migration liên quan feature |
| `backend/scripts` | verification, maintenance, release/ops scripts | `backend/scripts/README.md`, `package.json` scripts |
| `backend/ops/production` | runbook, Caddy, release/rollback/gates/backup | `PRODUCTION_RUNBOOK.md`, `Caddyfile` |
| `frontend/src/app/core` | auth/http/config/analytics primitives app-wide | `app.config.ts`, `core/auth`, `core/http` |
| `frontend/src/app/routes` | route composition | `app.routes.ts` và các `*.routes.ts` |
| `frontend/src/app/features` | UI theo scope account/admin/author/public | feature `domain`, `data-access`, `ui/pages` |
| `.github/workflows` | CI, image publication, deploy, rollback, CodeQL | `ci.yml`, `deploy-environment.yml` |

Thứ tự đọc mặc định cho thay đổi full-stack:

1. Route frontend tương ứng và page/store/repository của feature.
2. Backend controller request/response class.
3. Application command/query handler và port.
4. Domain policy/entity/value object.
5. Infrastructure Prisma/Redis/external adapter.
6. `schema.prisma` + migration + seed nếu chạm dữ liệu/RBAC.
7. Unit/integration/E2E tests gần feature.
8. Architecture checker và production scope/API matrix nếu thay đổi public contract.

---

## 3. Toolchain, manifests và lệnh quan trọng

### 3.1 Phiên bản nền

- Node được pin `24.15.0` tại `.nvmrc`; cả hai package yêu cầu `node 24.15.x`, `npm 11.12.x` và pin `npm@11.12.1` (`backend/package.json:249-252`, `frontend/package.json:30,62-64`).
- Backend: NestJS `11.1.x`, Prisma `7.9.x`, PostgreSQL adapter, BullMQ 5, Redis/ioredis, Passport JWT, bcryptjs, class-validator/class-transformer, Pino, Prometheus, OpenTelemetry, Cloudinary, Nodemailer (`backend/package.json`).
- Frontend: Angular `22.1.x`, Angular SSR `22.1.x`, RxJS, Vitest 4, Playwright 1.62, TypeScript 6 (`frontend/package.json`).
- Backend TypeScript target ES2023, CommonJS, alias `@/* -> src/*`; strict null checks bật nhưng `noImplicitAny` tắt (`backend/tsconfig.json:1-27`).
- Frontend bật strict và alias `@app`, `@core`, `@shared`, `@features` (`frontend/tsconfig.json:1-21`).

### 3.2 Backend scripts đáng nhớ

`backend/package.json` là catalog thực tế tốt nhất. Nhóm lệnh:

- Chạy: `start`, `start:dev`, `start:prod` (`dist/main.js`), `start:worker:dev`, `start:worker:prod` (`dist/worker.js`).
- Xây/kiểm: `build`, `format:check`, `lint`, `typecheck:scripts`, architecture boundary, DB/schema validation.
- Test: unit theo domain, integration theo domain, E2E auth/story/AI, coverage và aggregate quality.
- DB: Prisma generate/migrate/status/seed; constraint verification và drift/production checks.
- Maintenance: auth sessions/tokens, outbox, mail queue, media/Cloudinary, story counters, author followers, analytics.
- Ops: production compose validation, pre/post-deploy gate, release/rollback, backup/offsite/restore drill/recovery metrics.

`quality:check` là gate tổng hợp thay vì chỉ `npm test`: format + lint + script typecheck + architecture + DB validation + build + tests (`backend/package.json`). Các maintenance script destructive thường dry-run và chỉ mutate khi có `--apply` (`backend/scripts/README.md:3-10`).

### 3.3 Frontend scripts đáng nhớ

- `start`/`ng serve`, `build`, SSR build/serve.
- `lint`, `format:check`, architecture rules/check, typecheck, Vitest unit.
- Playwright E2E và các profile test (`frontend/package.json`, `frontend/playwright.config.ts`, `frontend/vitest.config.ts`).

Không tự suy rằng `npm test` đơn lẻ đại diện mọi gate CI. CI tách frontend quality, backend quality, backend integration, dependency audit, container build và frontend E2E (`.github/workflows/ci.yml:22-886`).

---

## 4. Architecture runtime: development và production

### 4.1 Development

**Repo evidence:** `backend/docker/compose.dev.yml` định nghĩa PostgreSQL 17, Redis 7, Mailpit, migrate, API, worker, cùng service/profile test (`backend/docker/compose.dev.yml:23-283`). Backend API chạy port 3000 trong luồng dev. Angular dev server nhận `/api/*` và proxy đến `http://localhost:3000` để cookie/browser/API cùng host semantics (`frontend/proxy.conf.json:1-8`, `frontend/src/environments/environment.ts:3-15`).

Luồng dev mong đợi:

```text
localhost:4200 (Angular dev + SSR tooling)
  /api/* --proxy--> localhost:3000 (Nest API)
Nest API/worker --> PostgreSQL + Redis
worker/mail       --> Mailpit trong compose dev
```

Frontend luôn dùng `apiBaseUrl: '/api/v1'` ở cả development và production; không hardcode origin public trong browser (`frontend/src/environments/environment.ts:1-17`, `frontend/src/environments/environment.production.ts:1-5`).

### 4.2 Production declarative topology

**Repo evidence:** `backend/compose.production.yml` có các service sau:

- Core: `postgres`, `redis`, one-shot `migrate`, optional-profile `seed`, `api`, `worker`, `frontend`, `caddy` (`backend/compose.production.yml:47-323`).
- Reliability/ops: `recovery-metrics`, `gate-predeploy`, `gate-postdeploy`, `auth-cleanup`, `outbox-cleanup`, `mail-queue-cleanup`, `backup-postgres`, `backup-offsite`, `postgres-restore-drill` (`backend/compose.production.yml:235-567`).
- API/worker dùng backend image immutable theo full Git SHA; frontend cũng yêu cầu tag immutable. Services quan trọng có `read_only`, dropped capabilities, pids/resource limits và JSON logging (`backend/compose.production.yml:4-45,132-218`).
- Defaults về memory trong file là PostgreSQL 1536m, Redis 512m, API 768m, worker 768m, frontend 384m, Caddy 256m; đây chỉ là **default declarative**, không chứng minh host có đủ RAM hay live đang dùng các giá trị đó (`backend/compose.production.yml:68-69,103-104,159-160,181-182,217-218,322-323`).

Caddy:

- Site address lấy từ `APP_DOMAIN`, fallback HTTP localhost.
- Bật zstd/gzip, security headers và request-body limit.
- `/api` và `/api/*` reverse proxy đến `api:3000`; các path khác đến `frontend:8080`.
- Upstream health check là backend readiness và frontend `/health`; logs JSON (`backend/ops/production/Caddyfile:11-59`).

Angular SSR container cần `SSR_API_ORIGIN` để gọi API server-side và `APP_PUBLIC_ORIGIN` để tạo public/canonical origin; production khởi động fail nếu thiếu hoặc không phải absolute HTTP(S) origin (`frontend/src/app/core/config/app-runtime-config.server.ts:48-93`, `frontend/src/server.ts:94-120`).

**Uncertainty/live gap:** không có kiểm tra trong reconnaissance này rằng compose file này đang được chạy, SHA image nào live, Caddy đã cấp TLS, DNS đúng, SMTP/Cloudinary/AI credentials hợp lệ, backup thực sự được restore, hoặc resource limits phù hợp host.

### 4.3 `compose.vps.yml`

Repo còn `backend/compose.vps.yml`, kiểu override/legacy topology, expose API và frontend loopback và có Mailpit. Pipeline production/runbook hiện tập trung vào `compose.production.yml`; đừng tự chọn `compose.vps.yml` khi sửa deploy nếu chưa đọc call site. **Inference:** đây là phương án VPS cũ hoặc local-on-VPS, không phải source duy nhất của production truth.

---

## 5. Backend entrypoints và composition roots

### 5.1 API process

`backend/src/main.ts`:

1. Load environment trước import phần còn lại.
2. Set default OTel service name `quan-ly-truyen-api`.
3. Start telemetry động.
4. Gọi `runApplication` (`backend/src/main.ts:1-18`).

`runApplication` chạy production bootstrap gate trước khi tạo Nest app, sau đó `NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })`, gắn Pino, application/security/CORS/shutdown/Swagger, rồi listen host/port từ config (`backend/src/bootstrap/application.bootstrap.ts:17-49`). `rawBody: true` cần cho signature verification của webhook.

`AppModule` là composition root của API. Nó import config/observability/common/infrastructure/health và toàn bộ domain modules, rồi apply `RequestContextMiddleware`, `LocaleMiddleware`, `MaintenanceModeMiddleware` cho mọi route (`backend/src/app.module.ts:47-135`).

### 5.2 Worker process

`backend/src/worker.ts` tương tự API nhưng OTel service name là worker và gọi `runWorker` (`backend/src/worker.ts:1-18`). Worker gate chạy trước `NestFactory.createApplicationContext(WorkerModule)` để processor không consume job trước khi production config/preflight hợp lệ (`backend/src/bootstrap/worker.bootstrap.ts:12-49`).

`WorkerModule` luôn có config/observability/media và `CloudinaryWebhookInboxWorker`; Redis/Bull/outbox/mail/notification/analytics/AI workers chỉ được import nếu queue+Redis enabled và `WORKER_ROLE` là `all` hoặc `queue` (`backend/src/worker.module.ts:16-45`). Đây là một process headless, không mở HTTP API.

### 5.3 SSR process

- Browser entry `frontend/src/main.ts` fetch `/api/v1/auth/client-config` trước khi bootstrap Angular; startup fail nếu response không OK hoặc shape invalid (`frontend/src/main.ts:1-17`, `frontend/src/app/core/config/app-runtime-config.loader.ts:6-27`).
- Server entry `frontend/src/main.server.ts` dùng config giả tối thiểu chỉ trong route discovery, còn runtime thực fetch auth client config từ `SSR_API_ORIGIN` (`frontend/src/main.server.ts:1-23`, `frontend/src/app/core/config/app-runtime-config.server.ts:11-66`).
- `frontend/src/server.ts` là Node HTTP entry quanh `AngularNodeAppEngine`: trust forwarded host/proto, `/health` kiểm tra browser index, `/index.html` no-store, default port 8080 (`frontend/src/server.ts:13-120`).

---

## 6. Backend module architecture và dependency rules

### 6.1 Shape chuẩn của một module

Một feature thường theo cấu trúc:

```text
modules/<feature>/
  application/
    commands/ queries/ dto/ mappers/ ports/
  domain/
    entities/ value-objects/ enums/ events/ exceptions/ policies/ repositories/
  infrastructure/
    persistence/ cache/ queue/ external-adapters/
  presentation/http/
    controllers/ requests/ responses/
  <feature>.module.ts
  index.ts
```

Đây không chỉ là convention mềm. `backend/scripts/architecture/check-boundaries.mjs` enforce:

- application không được có `*Service`/`application/services`;
- module A không import internals của module B, phải qua root public contract;
- domain không import Nest, Prisma hay infrastructure;
- application/presentation không import infrastructure hoặc Prisma trực tiếp (`backend/scripts/architecture/check-boundaries.mjs:8-27,83-217`).

`backend/src/infrastructure/infrastructure.module.ts:1-25` gom Prisma, Cache, Lock, Idempotency và Queue. Cross-module import quan sát được chủ yếu qua `AuthAuthorizationModule`, `AuthorsModule`, `ChaptersModule`, `UsersModule`; chưa thấy cycle hiển nhiên trong static import scan. **Uncertainty:** chưa chạy graph tool/runtime DI trong reconnaissance này.

### 6.2 Catalog domain modules

| Module | Trách nhiệm chính | Public HTTP / cross-module note |
|---|---|---|
| `auth` | register/login/refresh/logout, token/session, OAuth, MFA, password/email/security recovery, authorization cache | Tách `AuthCoreModule`, `AuthSessionsModule`, `AuthCredentialsModule`, `AuthOAuthModule`, `AuthAccountSecurityModule`, `AuthAuthorizationModule` (`backend/src/modules/auth/*.module.ts`) |
| `users` | self profile/preferences; admin user status/roles | Export `USER_MODERATION_PORT` và status handler cho moderation (`users.module.ts:31-84`) |
| `authors` | public directory/detail, active-author assertion, author profile/dashboard, admin lifecycle | Export `AssertActiveAuthorQueryHandler`, `ActiveAuthorGuard` (`authors.module.ts:46-76`) |
| `author-applications` | config/draft/submit/review tác giả | Lifecycle policy thuần; approval tạo/activate author và role theo persistence flow |
| `stories` | public catalog/detail; author draft/contributors/submission; admin review | Import authorization + authors (`stories.module.ts:40-50`) |
| `chapters` | public reader/list; author draft/publish/update/delete | Export persistence port cho AI translation; import authors (`chapters.module.ts:21-39`) |
| `categories` | admin taxonomy category | RBAC; hierarchical data trong schema |
| `tags` | admin tag CRUD/merge | RBAC; merge cần quan tâm join rows |
| `comments` | public reads, authenticated writes/replies/reactions/reports | Prisma + Redis; moderation là module khác (`comments.module.ts:43-50`) |
| `moderation` | admin hold/hide/restore/remove comment, warn/ban user | Import Users public contract (`moderation.module.ts:19-22`) |
| `reports` | admin list/detail/resolve/reject reports | Report creation cho comment nằm trong comments module |
| `ratings` | get own/upsert/delete story rating | Cập nhật aggregate rating/counter |
| `libraries` | personal library status | `/library` |
| `reading-history` | progress/history và chapter bookmarks | `/reading-history`, `/reading-progress`, `/reading-bookmarks` |
| `reading-goals` | get/upsert mục tiêu đọc cá nhân | `/reading-goal` |
| `follows` | follow author/story và list | Có notification dedupe/follower counters liên quan schema/migrations |
| `notifications` | notification inbox/settings + worker fanout | Worker module riêng (`notifications-worker.module.ts:6-8`) |
| `analytics` | public reader event ingest, author aggregates/views | API module Prisma+Redis; worker module aggregation (`analytics.module.ts:24-49`) |
| `media` | upload intent, confirm, lookup/delete, Cloudinary webhook inbox/cleanup | Export adapters/ports cần cho author/story/profile; worker inbox luôn load (`media.module.ts:41-86`) |
| `audit-logs` | admin read audit trail | Observability-integrated persistence (`audit-logs.module.ts:18-27`) |
| `ai` | connections/models/capability probes, chat/SSE, policies/profiles/usage, chapter translation | Module lớn; worker translation riêng và import chapters (`ai.module.ts:158+`, `ai-worker.module.ts:43-45`) |

### 6.3 Luồng dependency điển hình

```text
Controller
  -> validated Request class
  -> new Command/Query
  -> Handler
      -> Domain policy/value object/entity
      -> injected application Port token
          -> Infrastructure adapter (Prisma/Redis/Cloudinary/SMTP/AI)
  -> Response mapper
  -> global envelope interceptor
```

Không bypass handler/port bằng cách inject Prisma trực tiếp vào controller hoặc application. Nếu module cần capability của module khác, export qua `<module>/index.ts` và import public root; architecture checker có chủ ý chặn deep imports.

---

## 7. HTTP request pipeline, contract và error model

### 7.1 Prefix và global pipeline

- API prefix là `api/v1` (`backend/src/common/constants/application.constants.ts:7-20`).
- `configureApplication` set prefix, nhưng exclude GET `internal/metrics`; đồng thời cấu hình raw JSON capture, body limits, urlencoded và trust proxy (`backend/src/bootstrap/application-configurator.ts:13-44`). Vì vậy metrics path là `/internal/metrics`, còn controllers khác thường là `/api/v1/...`.
- Global guards chạy theo thứ tự JWT -> roles -> permissions (`backend/src/common/guards/common-guards.module.ts:10-45`). Default là protected; `@Public()` mới bypass JWT (`backend/src/common/guards/jwt-auth.guard.ts:11-31`).
- `PermissionsGuard` đòi **tất cả** permission metadata, không phải any-of (`backend/src/common/guards/permissions.guard.ts:10-38`).
- `ActiveAuthorGuard` bổ sung kiểm tra lifecycle tác giả cho author routes.

### 7.2 Validation

`AppValidationPipe` bật transform có kiểm soát, không implicit conversion, whitelist và `forbidNonWhitelisted`; gom toàn bộ validation errors thành issue list thay vì chỉ error đầu (`backend/src/common/pipes/app-validation.pipe.ts:30-54`). Request DTO thường dùng `@Type(() => Number)` hoặc `@Transform` rõ ràng.

Pagination chưa thống nhất tuyệt đối:

- Public/comments/analytics/taxonomy thường dùng `page` + `pageSize` với constants chung.
- Admin users/author applications dùng `offset` + `limit`.
- Không thấy cursor pagination là convention chính trong request scan (`backend/src/modules/**/presentation/http/requests`).

Khi thêm endpoint, copy convention của **module gần nhất**, đừng tự chuẩn hóa toàn repo trong cùng PR.

### 7.3 Response và error envelope

Success bình thường được wrap:

```json
{
  "success": true,
  "data": {},
  "requestId": "...",
  "timestamp": "..."
}
```

Interceptor skip `StreamableFile` hoặc response đã được đánh dấu skip envelope (`backend/src/common/interceptors/response-envelope.interceptor.ts:51-69`).

Errors được global filter chuẩn hóa:

```json
{
  "success": false,
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "safe message",
    "details": {},
    "retryable": false
  },
  "requestId": "...",
  "timestamp": "...",
  "path": "/api/v1/..."
}
```

Filter set `x-request-id`, log structured và ghi OTel; normalizer che message nội bộ cho status >=500 và map standard HTTP exceptions (`backend/src/common/filters/all-exceptions.filter.ts:66-81`, `backend/src/common/filters/exception-normalizer.ts`).

Global interceptors gồm request logging, timeout và response envelope. Timeout thực tế được hardcode 15 giây tại `backend/src/common/constants/interceptor.constants.ts:3` và wired trong `common-interceptors.module.ts:12-32`.

### 7.4 Swagger và security bootstrap

Swagger nếu bật ở `${API_PREFIX}/docs`; production validation yêu cầu `SWAGGER_ENABLED=false` (`backend/src/bootstrap/swagger.bootstrap.ts:11-42`, `backend/src/config/environment.validation.ts:1098-1101,1302-1304`). Security bootstrap/CORS phụ thuộc config; cần đọc `backend/src/bootstrap/security.bootstrap.ts` và `cors.bootstrap.ts` khi đổi headers/origins.

---

## 8. API route map thực tế

Mọi route dưới đây mặc định có prefix `/api/v1`, trừ `/internal/metrics`. Bảng là map định hướng, không thay request/response DTO cụ thể.

### 8.1 Infrastructure và identity

| Nhóm | Routes | Access/notes | Evidence |
|---|---|---|---|
| Health | `GET /health/live`, `/ready`, `/diagnostics` | live/ready public; diagnostics cần audit-log permission | `backend/src/infrastructure/health/health.controller.ts:24-54` |
| Metrics | `GET /internal/metrics` | prefix-excluded; `MetricsGuard` bearer riêng dù gắn `@Public()` cho JWT | `backend/src/infrastructure/observability/metrics/metrics.controller.ts:13-25` |
| Auth runtime | `GET /auth/client-config` | public; frontend phải load trước bootstrap | `auth-client-config.controller.ts:30-45` |
| Token | `POST /auth/login`, `/refresh`, `/logout`, `/logout-all`, `/revoke-access-token` | refresh/logout dùng cookie+CSRF guard semantics | `auth-token.controller.ts:52-275` |
| Credentials | register, verify/resend email, forgot/reset validate/reset, change password/email/confirm | public hoặc protected tùy flow | `auth-credentials.controller.ts:63-340` |
| OAuth | `GET /auth/oauth/:provider`, callback; `POST /auth/oauth/finalize` | redirect + one-use handoff | `oauth.controller.ts:37-230` |
| MFA challenge | enrollment/confirm/verify dưới `/auth/mfa` | preliminary challenge ticket | `mfa.controller.ts:27-130` |
| MFA settings | get/enroll/confirm/delete/recovery-codes dưới `/auth/security/mfa` | authenticated security flow | `mfa-security.controller.ts:34-225` |
| Account security | `/auth/me`, sessions, trust, delete account, overview/events, revoke | self-service | `auth-account.controller.ts:61-330` |
| Recovery | `/auth/security/recovery-email/*`, `/auth/security/questions/*` | authenticated + verification controls | corresponding controllers |
| Admin security | `/admin/users/:userId/sessions`, revoke/revoke-all/unlock/events | privileged | `admin-user-security.controller.ts:23-98` |
| Users | `GET/PATCH /users/me`, preferences; admin list/detail/status/roles | self vs privileged | `users.controller.ts:36-130`, `admin-users.controller.ts:48-150` |

### 8.2 Content, author và engagement

| Nhóm | Routes chính | Evidence |
|---|---|---|
| Public stories | `GET /stories`, `/stories/:slug` | `public-stories.controller.ts:19-55` |
| Public chapters | `GET /stories/:storySlug/chapters`, `.../:chapterNumber` | `public-chapters.controller.ts:17-54` |
| Story metadata | `GET /story-metadata/categories`, `/tags` | `story-metadata.controller.ts:15-35` |
| Author stories | list/get/create/update/delete; submit/cancel submission dưới `/author/stories` | `author-stories.controller.ts:54-215` |
| Contributors | get/replace/delete role dưới `/author/stories/:storyId/contributors` | `author-story-contributors.controller.ts:26-65` |
| Author chapters | list/get/create/publish/update/delete dưới `/author/stories/:storyId/chapters` | `author-chapters.controller.ts:51-185` |
| Admin publication | list/detail/approve/reject `/admin/story-submissions` | `admin-story-moderation.controller.ts:22-64`, `admin-story-publication.controller.ts:33-84` |
| Public authors | list/detail `/authors` | `public-authors.controller.ts:17-36` |
| Author portal backend | `/author/profile`, `/author/dashboard` | profile/controller evidence |
| Admin authors | list/detail/status `/admin/authors` | `admin-authors.controller.ts:36-82` |
| Author application | config/me/save draft/submit; admin list/detail/approve/reject | author application controllers |
| Categories | admin list/create/update/delete | `admin-categories.controller.ts:38-105` |
| Tags | admin list/create/update/delete/merge | `admin-tags.controller.ts:42-120` |
| Library | get/upsert/delete `/library[/:storyId]` | `libraries.controller.ts:27-72` |
| Reading | history, progress, bookmark CRUD, reading goal get/upsert | reading-history/bookmarks/goals controllers |
| Follow | author/story follow/unfollow/get/list | `author-follow.controller.ts:35-125` |
| Rating | own rating get/upsert/delete | `ratings.controller.ts:27-72` |
| Comments | public story/chapter list; create/update/delete; replies/reactions/report | three comments controllers |
| Notifications | list/read/save/read-all/settings | `notifications.controller.ts:39-115` |
| Reports/moderation | admin report list/detail/resolve/reject; comment hold/hide/restore/remove/warn/ban | reports and moderation controllers |
| Audit | admin list/detail | `admin-audit-logs.controller.ts:34-70` |

### 8.3 Media, analytics và AI

| Nhóm | Routes chính | Evidence |
|---|---|---|
| Media | `POST /media/upload-intents`, confirm; get/delete media | `media.controller.ts:34-92` |
| Cloudinary webhook | `POST /webhooks/cloudinary` | public raw-body signature path | `cloudinary-webhook.controller.ts:18-35` |
| Reader analytics | public config/event ingest | `reader-analytics.controller.ts:20-50` |
| Author analytics | overview/story list/detail | `author-analytics.controller.ts:17-57` |
| AI connections | user and admin CRUD/test/models/capability probe | AI connection controllers |
| AI chat | conversation list/create/get/delete, message, SSE stream | `ai-chat.controller.ts:57-160` |
| AI policy/profile/usage | own policy/profile/usage; admin user policy and aggregate usage | AI policy/profile/usage controllers |
| Chapter translation | create/get target-language translation; author story AI profile | `chapter-translations.controller.ts:33-80`, `ai-profile.controller.ts:56-85` |

**Known drift:** `backend/ops/production/API_CONTRACT_MATRIX.md` hiển thị một số frontend path cũ như `/quen-mat-khau`, `/dat-lai-mat-khau`, `/lich-su-doc`, `/author-studio/profile`; route code hiện dùng `/forgot-password`, `/reset-password`, `/lich-su`, `/author-studio/ho-so`, v.v. Xem section Risks trước khi tin route display trong generated doc.

---

## 9. Authentication, authorization và frontend session state

### 9.1 Backend auth model

Access token và refresh token chứa session/version information. `Session` lưu **hash** refresh token, family ID, refresh/access versions, device/IP/UA, trusted state, MFA/auth method, expiry/revocation (`backend/prisma/schema.prisma:788-818`). Raw refresh token đi qua cookie; DB không lưu plaintext.

Login flow (`LoginCommandHandler`):

1. Normalize identifier/password qua value objects.
2. Check Redis-backed limiter trước bcrypt.
3. Luôn bcrypt compare, kể cả account không tồn tại, bằng dummy hash để giảm user enumeration timing.
4. Enforce account active/not deleted/email verified.
5. Reset limiter phải thành công trước tạo session.
6. Nếu user bật MFA hoặc ADMIN bắt buộc MFA, tạo challenge và throw `MfaRequiredException` thay vì tạo session.
7. Nếu không, issue tokens và persist hashed refresh session (`backend/src/modules/auth/application/commands/login/login.command-handler.ts:1-155`).

Refresh flow:

1. Verify JWT refresh claims; lookup session.
2. Check user/family/status/expiry/revocation.
3. So hash và version.
4. Nếu mismatch, coi là token reuse, revoke compromised family.
5. Issue next refresh version; CAS rotate DB.
6. Race thua cũng bị coi là reuse và revoke family (`refresh-token.command-handler.ts:26-163`).

Access token bình thường không bị rotate/increment version khi refresh; token access cũ sống tới TTL. Revocation/blacklist và access version là các đường vô hiệu hóa khác. Default config trong repo: access TTL 900s, refresh TTL 2,592,000s; xác minh env live trước khi dựa vào defaults (`backend/src/config/auth.config.ts`).

Refresh/logout CSRF guard parse raw `Cookie`, reject duplicate/malformed cookie; logout có đường idempotent nếu cookie đã vắng. OAuth state/handoff dùng Redis và handoff one-use; Google/GitHub outbound calls có timeout khoảng 10 giây (`backend/src/modules/auth/infrastructure/oauth/oauth-flow.adapter.ts`). Schema enum còn `FACEBOOK`, nhưng runtime config/controller/parser chỉ thấy Google/GitHub: coi Facebook là schema residue, không phải supported feature (`schema.prisma:57-63`).

### 9.2 RBAC

Seed tạo ba system roles:

- `USER`: profile/security/account deletion, story read, comment/rating/library/follow/history/bookmark/goal/report/media/notification/AI user capabilities.
- `AUTHOR`: kế thừa user + own story/chapter/contributor/analytics/translation permissions.
- `ADMIN`: toàn bộ permissions (`backend/prisma/seed.ts:14-206`).

Role names được frontend normalize uppercase; permission codes normalize lowercase. Frontend route guards yêu cầu all permissions tương ứng backend guard semantics.

### 9.3 Frontend token/session model

- `TokenStore` chỉ giữ access token trong Angular signal memory; không persist access token vào localStorage/sessionStorage (`frontend/src/app/core/auth/token.store.ts:3-15`).
- Refresh token là HttpOnly cookie do backend quản lý. Frontend chỉ lưu boolean hint `truyenhub.auth.has-refresh-session` hoặc suy từ CSRF cookie để biết có đáng thử refresh hay không (`auth-session-hint.store.ts:7-51`).
- `AuthStore.ensureInitialized()` chỉ thử refresh nếu có session hint, rồi gọi `/auth/me`; state terminal phân biệt `authenticated`, `anonymous`, `unavailable`. Vì vậy guard không biến network outage thành logout giả (`auth.store.ts:71-225`).
- HTTP interceptor chỉ chạm request bắt đầu bằng configured API base. Nó gắn Bearer nếu có access token, gắn CSRF header cho mutating request, `withCredentials` khi cần, và refresh 401 chỉ khi request có token. Có xử lý single-flight/late-401 (`frontend/src/app/core/http/api.interceptor.ts:17-211`).
- `AuthRefreshService` single-flight trong tab; `AuthRefreshCoordinatorService` dùng Web Locks khi có, fallback storage lease giữa tabs, SSR thì gọi trực tiếp (`auth-refresh.service.ts:27-115`, `auth-refresh-coordinator.service.ts:9-35`).
- Chỉ stable auth errors như invalid refresh/reuse làm session invalid. Network/5xx/CSRF failure có thể làm mất access tạm thời nhưng không xóa session hint ngay.
- OAuthBrowserService chỉ cho return URL nội bộ đã sanitize, giữ trong sessionStorage và dùng full-page navigation đến `/auth/oauth/:provider`, tránh open redirect (`oauth-browser.service.ts:9-78`).

Đây là BFF-ish same-origin cookie model, không phải SPA lưu JWT lâu dài. Khi debug “mất đăng nhập sau reload”, đọc cả cookie flags, CSRF, session hint, bootstrap refresh và `/auth/me`; đừng chỉ tìm localStorage token.

---

## 10. Frontend architecture, routes và state/data flow

### 10.1 Standalone app composition

`createAppConfig(runtimeConfig)` cung cấp `APP_RUNTIME_CONFIG`, `HttpClient` với `apiInterceptor`, hydration/event replay, router component input binding, scroll restoration và view transitions (`frontend/src/app/app.config.ts:19-45`). Server config remap SSR API origin sang public origin cho transfer cache/SEO (`frontend/src/app/app.config.server.ts:8-21`).

Frontend architecture checker enforce layers `domain`, `data-access`, `pages`, `ui`:

- domain không import Angular/data-access/pages/ui;
- data-access không import pages/ui;
- ui không import data-access/pages;
- feature internals không deep-import chéo; cross-feature đi qua root `index` hoặc same-scope shared (`frontend/scripts/architecture-rules.mjs:3-9,37-145,216-243`).

Feature scopes:

- `account`: auth, email confirmation, forgot/reset password, profile/security, author application, following, library, notifications, history, AI assistant.
- `admin`: shell, users, authors, author applications, story review, categories, tags, reports, audit logs, AI settings.
- `author-portal`: author studio, author profile, analytics, chapter translation.
- `public`: home, catalog/ranking/updates/genre, story, chapter reader, comments, author directory/detail, static pages.

Data flow phổ biến:

```text
route -> lazy page/component
      -> route-scoped provider/store/facade
      -> repository interface/domain model
      -> HTTP repository/api service
      -> HttpClient + global interceptor
```

Không phải mọi feature đã hoàn toàn theo cùng naming; có cả `store`, `facade`, `controller`, `api.service`, `http.repository`. Hãy giữ local convention của feature trừ khi task là kiến trúc.

### 10.2 Route topology

`frontend/src/app/app.routes.ts:11-28` tách author studio, admin và auth ra ngoài `AppShell`; shell chứa public/account/legacy author routes; wildcard về home.

Public routes (`frontend/src/app/routes/public.routes.ts:16-164`):

- `/`
- `/truyen/:slug`
- `/truyen/:storySlug/chuong/:chapterNumber`
- `/danh-sach`, `/the-loai`, `/xep-hang`, `/cap-nhat`
- `/gioi-thieu`, `/dieu-khoan`, `/quyen-rieng-tu`, `/cong-dong`
- `/tac-gia`, `/tac-gia/:authorSlug`

Auth routes (`frontend/src/app/routes/auth.routes.ts`):

- `/tam-thoi-khong-the-xac-thuc`, `/dang-nhap`, `/khong-co-quyen`
- `/verify-email`, `/oauth/callback`
- `/forgot-password`, `/reset-password`, `/change-email/confirm`

Account routes (`frontend/src/app/routes/account.routes.ts`): `/tai-khoan`, `/lich-su`, `/dang-theo-doi`, `/thong-bao`, `/thu-vien`, `/dang-ky-tac-gia`; nested account security có personal info, password/email, MFA, recovery email/questions, devices, activity, AI assistant và reading goal (`frontend/src/app/features/account/profile/account.routes.ts:6-117`).

Author studio (`author-studio.routes.ts`): `/author-studio` với authenticated + AUTHOR + `story.create`; children dashboard/profile/analytics/story CRUD/chapter CRUD; legacy `/tac-gia-studio` redirect. Child route có permission guards riêng.

Admin (`admin.routes.ts:32-179`): `/admin` guarded shell; users, authors, story review/detail, reports, categories, tags, author applications, audit logs, AI settings.

SSR chỉ server-render các route public được liệt kê; wildcard là `RenderMode.Client` (`frontend/src/app/app.routes.server.ts:3-22`). Auth/account/admin/author portal vì thế không nên giả định được SSR.

### 10.3 Runtime config coupling

Frontend không compile cứng password/CSRF policy. Cả browser lẫn SSR fetch `GET /api/v1/auth/client-config`, parser kiểm tra shape và inject policy. Backend downtime tại bootstrap có thể làm frontend startup/request SSR fail; server cache promise thành công nhưng reset promise khi fetch fail để request sau retry (`app-runtime-config.loader.ts:6-27`, `app-runtime-config.server.ts:9-21`).

---

## 11. Prisma data model và invariants

### 11.1 Tổng quan

`backend/prisma/schema.prisma` dùng PostgreSQL, 58 models và 37 enums. Nên nghĩ theo cụm:

**Identity/auth:** `User`, `OAuthAccount`, `AdminMfaCredential`, `MfaCredential`, `MfaRecoveryCode`, `RecoveryEmail`, `SecurityQuestion`, `UserSecurityQuestion`, `TrustedDevice`, `AccountDeletionRequest`, `Session`, `UserToken`, `Role`, `Permission`, `UserRole`, `RolePermission` (`schema.prisma:365-900`).

**AI:** `AiConnection`, `AiConversation`, `AiMessage`, `AiUsage`, `AiUserPolicy`, `AiUserProfile`, `AiStoryProfile`, `AiRateLimitBucket`, `ChapterTranslation` (`schema.prisma:503-687`). `AiConnection.userId=null` biểu diễn system/admin connection; non-null là user-owned.

**Author/content/media:** `AuthorApplication`, `AuthorProfile`, `UserFollowAuthor`, `MediaAsset`, `ChapterMedia`, `Story`, `StoryContributor`, `Category`, `StoryCategory`, `Tag`, `StoryTag`, `Chapter`, `ChapterVersion` (`schema.prisma:903-1279`).

**Engagement:** `LibraryEntry`, `StoryFollow`, `Rating`, `Comment`, `CommentReaction`, `ReadingBookmark`, `ReadingProgress`, `ReadingSession`, `ReadingGoal` (`schema.prisma:1286-1459`).

**Moderation/ops/analytics:** `StorySubmission`, `Report`, `ModerationAction`, `Notification`, `NotificationPreference`, `AuditLog`, `OutboxEvent`, `InboundWebhookEvent`, `ReaderAnalyticsEvent`, `StoryDailyStat`, `ChapterDailyStat` (`schema.prisma:1468-1737`).

### 11.2 Cardinalities và lifecycle quan trọng

- `User` là root identity, liên kết roles, sessions, tokens, profiles, applications, content/engagement/security/AI (`schema.prisma:365-433`). Soft delete/status tồn tại; đừng dùng hard delete như mặc định.
- `AuthorProfile.userId` là primary key/one-to-one với user. Author có verification/lifecycle status và denormalized follower/story counts (`schema.prisma:956-988`).
- `AuthorApplication` là một đơn trên user với status `DRAFT/PENDING/APPROVED/REJECTED`, snapshot fields và optional sample media (`schema.prisma:903-954`). Lifecycle policy cho phép rejected mở lại draft, pending không resubmit, approved là terminal; review chặn self-review và chỉ review pending (`author-application-lifecycle.policy.ts:30-126`).
- `Story` có status/visibility/content rating, owner/contributors/categories/tags/chapters/submissions, và nhiều denormalized counters (`schema.prisma:1076-1132`). Submission tách khỏi story để audit review cycle.
- `Chapter` có `DRAFT/PUBLISHED/SCHEDULED/ARCHIVED` trong enum, content format, timestamps/counters; `ChapterVersion` tồn tại nhưng production scope ghi workflow versioning bị deferred (`schema.prisma:192-208,1216-1279`, `backend/ops/production/PRODUCTION_V1_SCOPE.md`).
- `Comment` self-reference root/parent hỗ trợ thread; moderation state và soft deletion tách khỏi reaction/report (`schema.prisma:1343-1387`).
- `Report` là polymorphic target; DB constraint bảo đảm đúng một target phù hợp type. `ModerationAction` cũng polymorphic nhưng có constraint one-target (`schema.prisma:1490-1555`).
- `OutboxEvent` và `InboundWebhookEvent` lưu retry/lease/ownership/status metadata, không chỉ payload/status đơn giản (`schema.prisma:1617-1664`).

### 11.3 DB-level constraints không thể thấy hết trong Prisma DSL

Migration SQL là nguồn truth quan trọng. Các invariants nổi bật:

- Rating trong 1..5; aggregate rating 0..5.
- Chapter number >0; reading progress 0..100; positions, sizes, counters không âm.
- Report có đúng một target tương ứng `targetType`; moderation action có đúng một target.
- Mỗi story có tối đa một primary category và tối đa một pending submission.
- Open report uniqueness theo target.
- Reader analytics event/context uniqueness và shape constraints.
- Category/tag name uniqueness case-insensitive.
- Pending author pen name uniqueness và author slug lower-case uniqueness.
- MFA/recovery email/trusted device/account deletion có state consistency checks.

Evidence chính: `backend/prisma/migrations/20260731065244_init_story_management/migration.sql:1075-1145`, `20260807054000_expand_account_security_and_frontend_support/migration.sql:37-468`, `20260808143000_enforce_pending_author_pen_name_uniqueness/migration.sql:7-52`, `20260816153000_add_taxonomy_name_uniqueness/migration.sql:13-14`, `20260816233000_add_reader_analytics/migration.sql`.

Khi thay schema, không chỉ edit `schema.prisma`: cần migration SQL, constraint verifier, production compatibility và seed/test updates.

### 11.4 Migration history và seed

Có 37 migration folders từ `20260731065244_init_story_management` đến `20260907010000_add_ai_usage_read_indexes`. Các phase dễ nhận:

1. Initial story/media/auth/webhook/infrastructure hardening.
2. Registration outbox, secure sessions, OAuth/MFA/account security.
3. Author applications/lifecycle, taxonomy uniqueness, comments/moderation/audit/follows.
4. Reader analytics/sessions/goals.
5. AI assistant -> connections -> usage/streaming -> chapter translation -> rate limits/profile/protocol/model/capabilities/indexes.

`backend/prisma/seed.ts` upsert system permissions/roles và security question catalog; seed được thiết kế idempotent qua upsert. Có seed E2E riêng trong test tooling. Không chạy production seed bừa bãi: compose đặt seed trong optional profile (`backend/compose.production.yml:120-130`).

### 11.5 Denormalized data

Story/author/comment/analytics chứa counters và daily aggregates. Repo có scripts reconcile story counters/author followers/analytics. **Inference:** write paths cố cập nhật transactionally hoặc qua worker, nhưng drift vẫn là failure mode được repo thừa nhận qua maintenance scripts. Khi thấy count sai, kiểm tra source rows + reconciliation trước khi “fix” UI.

---

## 12. Lifecycle flows xuyên module

### 12.1 Đăng ký và xác minh email

`RegisterCommandHandler` tạo user/token và kết nối registration outbox; mail side effect không nên nằm trong transaction request. `UserToken` lưu hash token và type/expiry/consumption (`schema.prisma:821-835`). Verify/resend/reset/change email đều có command handler/policy riêng trong auth application/domain.

### 12.2 Trở thành tác giả

```text
USER
 -> GET application config
 -> PUT /author-applications/me/draft
 -> POST /author-applications/me/submit
 -> status PENDING
 -> ADMIN approve/reject
 -> approve: AuthorProfile/role/lifecycle updates
 -> AUTHOR routes additionally require ActiveAuthorGuard
```

Lifecycle policy kiểm required fields + accepted terms, idempotent outcomes và self-review prohibition (`author-application-lifecycle.policy.ts:30-126`). Pending pen name được bảo vệ bằng unique index migration để tránh race (`20260808143000_enforce_pending_author_pen_name_uniqueness/migration.sql:7-52`).

### 12.3 Story publication

```text
active AUTHOR
 -> create/update story draft
 -> manage contributors/categories/tags
 -> submit -> StorySubmission(PENDING)
 -> ADMIN approve/reject
 -> story publication state/visibility updated
```

DB chặn hơn một pending submission/story. Cancel submission là route riêng. Story owner/contributor authorization đi qua author/story application ports, không chỉ role check.

### 12.4 Chapter publication -> notification + AI

Chapter draft publish persistence transaction ghi chapter state và tạo outbox events:

- `notification.author-chapter-published.v1`
- `ai.auto-translate-chapter-published.v1`

(`backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts:667-695`). Outbox worker route aggregate/event sang notification hoặc AI queue. Notification fanout tạo inbox cho followers; AI worker chỉ translate nếu policy/profile/connection cho phép.

Chapter scheduling bổ sung `DRAFT -> SCHEDULED -> PUBLISHED`: author đặt/đổi lịch bằng `PUT .../:chapterId/schedule`, huỷ về draft bằng `DELETE .../:chapterId/schedule`, hoặc publish sớm bằng endpoint publish hiện có. BullMQ scheduler poll các row đến hạn; persistence lock story rồi chapter bằng `FOR UPDATE SKIP LOCKED`, recheck trạng thái và tạo audit + hai outbox event chỉ sau transition publish bền vững (`backend/src/modules/chapters/infrastructure/queue`, `author-chapters.controller.ts`, `prisma-chapter.persistence.ts`).

### 12.5 Media upload

```text
client asks upload intent
 -> backend validates purpose/resource/owner, creates MediaAsset pending + signed Cloudinary parameters
 -> client uploads directly to Cloudinary
 -> client confirms intent
 -> Cloudinary webhook independently enters durable inbox
 -> inbox worker verifies/applies status/delete events with retries
```

Điểm quan trọng: browser không upload binary xuyên Nest endpoint hiện tại; endpoint là `media/upload-intents`. Raw-body webhook/signature/inbox uniqueness là phần của correctness (`media.controller.ts:34-92`, `cloudinary-webhook.controller.ts:18-35`, `cloudinary-webhook.adapter.ts`).

### 12.6 Reader analytics

Public reader event ingestion persist raw event rồi enqueue/aggregate async. Recovery scheduler tìm row chưa enqueue; maintenance scheduler/worker cập nhật daily story/chapter stats. Author analytics queries đọc aggregates (`analytics-dispatcher.scheduler.ts`, `analytics-maintenance.scheduler.ts`, `prisma-reader-analytics-ingestion.adapter.ts`, `prisma-analytics-aggregation.adapter.ts`). Do đó analytics có eventual consistency.

---

## 13. Queue, outbox, schedulers, webhook và workers

### 13.1 Queue registry

Queue names (`backend/src/infrastructure/queue/queue.constants.ts:1-9`):

- `media`
- `mail`
- `notifications`
- `story-scheduling`
- `analytics`
- `outbox`
- `ai`

Observed processors/schedulers:

- Outbox scheduler + processor/dispatcher.
- Mail processor.
- Notification fanout processor.
- Analytics processor + dispatch/recovery/maintenance schedulers.
- AI translation processor.
- Chapter scheduling scheduler + processor; worker polls due chapters and publishes with row locking.
- Cloudinary webhook inbox worker (DB polling; luôn hiện diện trong WorkerModule).

**Uncertainty:** static scan không thấy processor chủ động cho `media`; queue này có thể là reserved/deferred capability. Chapter scheduling đã có scheduler/processor dưới `backend/src/modules/chapters/infrastructure/queue`, nhưng trạng thái worker/Redis live vẫn cần xác minh runtime.

### 13.2 Outbox mechanics

Outbox scheduler lặp theo configured interval, default khoảng 10 giây (`backend/src/infrastructure/queue/outbox/outbox-scheduler.service.ts:25-66`). Dispatcher:

- claim DB rows bằng `FOR UPDATE SKIP LOCKED`;
- gắn ownership token/lease, recover stale claims;
- enqueue theo aggregate/event mapping;
- complete hoặc retry/dead-letter với backoff;
- route hiện quan sát được đến mail/notifications/AI (`backend/src/infrastructure/queue/outbox/outbox-dispatcher.service.ts:79-438`).

Đây là at-least-once architecture; processor/consumer phải idempotent/dedupe. `Notification` có dedupe key migration và webhook inbox có provider/event key uniqueness.

Mail outbox payload mới được AES-256-GCM encrypt. Contract vẫn cho phép legacy plaintext field để compatibility đọc migration cũ (`backend/src/infrastructure/mail/contracts/mail.contracts.ts:1-60`). Production env validation cần encryption key; nhưng compatibility field còn đó là technical debt cần giữ ý thức.

### 13.3 Redis failure semantics

Redis không chỉ tăng tốc. Auth login limiter, JWT blacklist, authorization cache, OAuth state/handoff, MFA challenge, cross-request locks/idempotency và BullMQ có thể fail closed hoặc làm feature unavailable tùy adapter. Ví dụ login yêu cầu limiter reset thành công trước khi tạo session (`login.command-handler.ts`). Khi debug outage, phân biệt:

- PostgreSQL unavailable: source-of-truth failure.
- Redis unavailable: auth/queue/cache/coordination failure, một số request có thể fail dù DB khỏe.
- Worker stopped: API có thể trả success nhưng side effect/aggregate bị delay.

---

## 14. External integrations

| Integration | Chức năng | Repo evidence / caution |
|---|---|---|
| PostgreSQL 17 | identity, content, engagement, durable outbox/inbox/analytics | Prisma adapter + compose; version live chưa kiểm |
| Redis 7 | cache, lock, limiter, blacklist, OAuth/MFA ephemeral state, BullMQ | `RedisModule`, queue modules, compose |
| Cloudinary | direct signed upload, webhook, cleanup/delete | media infrastructure; signature/raw body required |
| SMTP/Nodemailer | transactional mail qua queue | Mailpit dev; live SMTP/DNS reputation chưa kiểm |
| Google OAuth | login/link identity | OAuth adapter/config; credential/callback live chưa kiểm |
| GitHub OAuth | login/link identity | tương tự Google |
| AI providers | OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, Gemini generateContent | native protocol adapters trong `modules/ai/infrastructure`; key encrypted, model/capability probing |
| OpenTelemetry OTLP | traces/telemetry | API/worker bootstrap + observability module |
| Prometheus | metrics scrape | `/internal/metrics` bearer guard |
| Loki/Tempo/Alloy/Grafana/Alertmanager | production observability stack | configs dưới `backend/ops/production/observability`; không chứng minh live |
| Caddy | TLS/reverse proxy/security headers | `backend/ops/production/Caddyfile` |
| Restic | offsite backup | optional compose profile/runbook; restore success live chưa kiểm |

Runbook liệt kê dependencies ngoài repo như DNS/firewall, SPF/DKIM/DMARC, SMTP permission, backup receiver và alert webhook (`backend/ops/production/PRODUCTION_RUNBOOK.md:12-22`). Đây là external prerequisites, không phải facts đã satisfied.

AI connection schema có credential ciphertext/IV/tag và capability flags, nhưng vẫn giữ các “legacy mirrors” trong giai đoạn expand-contract (`schema.prisma:527-529,553-554,592-593`). Bất kỳ migration AI nào phải đọc cả code protocol mới và legacy compatibility.

---

## 15. CI, image publication, deploy, rollback và recovery

### 15.1 CI

`.github/workflows/ci.yml` chạy khi push `main`, PR, merge group và manual. Jobs chính:

- `production-scope`: verify production V1 scope và API contract.
- `frontend-quality`: install pinned Node/npm, lint/format/architecture/typecheck/unit/build artifact.
- `backend-quality`: lint/format/architecture/schema/build/unit/coverage.
- `backend-integration`: PostgreSQL + Redis, migrations, constraint checks, integration/E2E.
- `dependency-audit`.
- `container-build`: build images, scan/smoke/security checks.
- `frontend-e2e`: Playwright với backend/frontend stack.
- `ci-success`: aggregate required gate (`.github/workflows/ci.yml:22-886`).

Ngoài CI còn CodeQL scheduled/push/PR (`codeql.yml`) và dependency review cho PR (`dependency-review.yml`).

### 15.2 Image workflows

`backend-images.yml` và `frontend-images.yml` trigger manual hoặc tag release tương ứng, verify source SHA có CI thành công, scan rồi publish GHCR images. Deployment contract dùng immutable full Git SHA, không dùng mutable `latest` (`.github/workflows/backend-images.yml`, `frontend-images.yml`).

### 15.3 Deploy

`Deploy Environment` có hai entry:

1. Automatic `workflow_run` sau workflow `CI` hoàn thành trên `main` -> production registry path.
2. Manual dispatch staging/production với full SHA và Registry/Local mode; Local chỉ phù hợp staging theo validation (`.github/workflows/deploy-environment.yml:1-39,42-205`).

Workflow verify commit/main/CI/images, có thể publish images trong automatic path, đóng gói tooling, pin SSH known_hosts, SCP bundle và chạy remote `Invoke-Release.ps1` (`deploy-environment.yml:206-320`). Đây là Continuous Deployment vì push qua CI có thể tự đi đến production; SSH chỉ chuyên chở và gọi release.

Runbook mô tả release state `current`, `previous`, history, pre/post gates và rollback (`backend/ops/production/PRODUCTION_RUNBOOK.md:189-255`). Failure sau một số container update có thể để mixed state và cần inspect; không giả định deploy atomic toàn stack.

### 15.4 Rollback và DB compatibility

Rollback workflow là manual, đòi full source SHA/image có sẵn. Production bắt người vận hành xác nhận DB backward compatibility. App rollback **không rollback database migration** (`.github/workflows/rollback-environment.yml:3-21,44-191`). Đây là constraint thiết kế rất quan trọng: migration production phải ưu tiên expand-contract và backward-compatible với ít nhất current/previous app.

Backup/restore tooling có checksum, `pg_restore`, offsite Restic, restore drill và recovery gate. **Live gap:** chỉ có scripts/config không chứng minh lịch backup chạy, repository offsite reachable hoặc restore drill gần nhất pass.

---

## 16. Tests và verification landscape

Snapshot file count tại lúc scan:

- Backend unit specs dưới `backend/src`: khoảng 150 `*.spec.ts`.
- Backend integration files: 15 dưới `backend/test/integration`.
- Backend E2E files: 8 dưới `backend/test/e2e`.
- Frontend unit specs: 36 dưới `frontend/src`.
- Frontend E2E TS files: 33 dưới `frontend/e2e`.

Backend có Jest configs chuyên domain: auth, users, taxonomy, stories, comments/moderation, author follow/applications, audit logs, analytics, AI (`backend/test/jest-*.json`). Integration/E2E dùng PostgreSQL/Redis thực trong CI, không chỉ mocks.

Frontend unit dùng Vitest; browser E2E dùng Playwright. CI E2E dựng stack và test cùng API, do đó thay route/auth cookie/SSR cần xem cả backend contract lẫn Playwright fixtures (`frontend/vitest.config.ts`, `frontend/playwright.config.ts`, `.github/workflows/ci.yml:757-880`).

Verification proportionate theo loại change:

- Pure domain policy: nearest unit spec + module quality/typecheck.
- Persistence/schema: migration status, DB constraint verifier, module integration tests.
- Controller/DTO/route: unit/integration + API contract matrix verifier.
- Auth/session/cookie: auth unit + auth integration + auth E2E, và frontend interceptor/store tests.
- SSR/routing: frontend unit/build + Playwright/route discovery.
- Queue/outbox: processor/scheduler tests + DB/Redis integration, kiểm idempotency/retry.
- Production scripts: compose config validation + gate dry-run; tuyệt đối không suy live success từ local parse.

---

## 17. Coding và design conventions quan trọng

### Backend

- Controller mỏng; command/query handler là use-case boundary.
- Application phụ thuộc tokenized ports; infrastructure bind token -> adapter trong module.
- Domain giữ pure TS, không Nest/Prisma.
- Request/response class riêng; mapper giữa persistence/domain/result/HTTP.
- Stable domain exception code qua global normalizer/envelope.
- Dùng transaction/DB constraint cho invariant có race; không chỉ validate ở DTO.
- Cross-module qua root `index.ts`/exported public contract.
- `@Public`, `@Roles`, `@Permissions`, `ActiveAuthorGuard` là authorization metadata/guard layers khác nhau; route public không đồng nghĩa không có guard khác (metrics là ví dụ).
- Production config validation fail-fast; worker gate trước processor startup.
- Maintenance mutation cần explicit `--apply`.

### Frontend

- Standalone lazy routes/components và route-scoped providers.
- Domain/data-access/ui/pages boundaries được script enforce.
- Runtime config qua injection token, không đọc environment rải rác trong feature.
- HTTP repository unwrap `ApiSuccessEnvelope`; errors dựa stable backend codes.
- Access token memory-only; không thêm persistence JWT tùy tiện.
- Guards chờ auth initialization và phân biệt anonymous/unavailable.
- SSR chỉ public routes; code browser-only phải guard platform/window/document.
- Cross-feature import qua public index/shared scope.

### Data/ops

- Migration forward-only/backward-compatible; rollback app không rollback DB.
- Image tag immutable full SHA.
- Outbox/inbox/queues là at-least-once; consumer cần dedupe/idempotency.
- Counters/analytics eventual consistency cần reconciliation.
- Repo config/runbook là declarative intent, không phải live evidence.

---

## 18. Hotspots, risks và technical debt có evidence

### 18.1 Rủi ro cao / operationally material

1. **Không có live verification.** Không khẳng định VPS hiện chạy commit này, CI pass, queue healthy, TLS/SMTP/backup đúng. Repo chỉ cung cấp code/config/runbook.
2. **Rollback app không rollback DB.** Production rollback cần backward-compatible schema xác nhận thủ công (`rollback-environment.yml:3-21,44-191`). Migration destructive/rename trực tiếp có blast radius lớn.
3. **Deploy có thể partial.** Runbook thừa nhận failure sau một số service update có thể cần inspect/repair; release không phải transaction nguyên tử (`PRODUCTION_RUNBOOK.md:242+`).
4. **Redis là functional dependency.** Login limiter/session blacklist/OAuth/MFA/BullMQ dùng Redis; không thể coi Redis outage chỉ là cache miss.

### 18.2 Code concentration

Các file rất lớn tại scan:

- `backend/src/modules/stories/infrastructure/persistence/prisma-story.persistence.ts` ~1578 lines.
- `backend/src/config/environment.validation.ts` ~1245.
- `prisma-author-application.persistence.ts` ~1064.
- `prisma-chapter.persistence.ts` ~988.
- `prisma-managed-user.repository.ts` ~941.
- `oauth-flow.adapter.ts` ~734.
- `prisma-mfa.persistence.ts` ~696.
- Frontend `home-page.component.scss` ~683; auth store ~436; auth dialog controller/template ~400+.

Rủi ro là coupling/change surface và khó review, không tự động nghĩa code sai. Khi sửa, dùng symbol-level search và tests gần behavior thay vì đọc tuần tự cả file.

Frontend architecture checker tự ghi debt budget: 49 inline templates, 45 inline styles, 2525 excess lines, 1007 component excess, 627 store excess, 38 files >=300 lines, 6 >=500; check dùng ratchet/hard limits để không tăng debt (`frontend/scripts/check-architecture.mjs:10-49`). Không “cleanup toàn bộ” trong feature PR.

### 18.3 Confirmed drift / transitional code

1. `AppModule` JSON content-type middleware exclude `POST /api/v1/media/upload`, nhưng controller hiện dùng `POST /media/upload-intents`; exclusion có vẻ stale (`backend/src/app.module.ts:127`, `media.controller.ts:43-55`). Cần xác minh intent trước sửa.
2. `HTTP_REQUEST_TIMEOUT_MS` được parse thành `app.requestTimeoutMs`, và validation dùng để so idempotency lease TTL, nhưng global timeout interceptor đang dùng constant 15,000ms; search không thấy config value wired vào interceptor (`backend/src/config/app.config.ts:18`, `environment.validation.ts:82,927-930`, `common/constants/interceptor.constants.ts:3`). Đây là config contract drift.
3. `API_CONTRACT_MATRIX.md` có frontend paths cũ so với current route files. Generator/verifier có thể chỉ kiểm HTTP bindings, không kiểm displayed client path; regenerate/review tooling trước khi tin doc.
4. Prisma AI models có comments `transitional legacy mirrors`; expand-contract cleanup chưa hoàn tất (`schema.prisma:527-529,553-554,592-593`).
5. `OAuthProvider` enum có `FACEBOOK` nhưng runtime only Google/GitHub. Không expose Facebook chỉ vì enum tồn tại (`schema.prisma:57-63`, auth OAuth config/adapter).
6. `MailQueuePayload` vẫn chấp nhận legacy plaintext compatibility dù đường mới encrypt AES-GCM (`mail.contracts.ts:1-60`).
7. Queue constant `media` tồn tại nhưng chưa thấy active processor trong static scan.
8. Root `AppController` trả “Hello World” nhưng không `@Public`, do đó nằm dưới protected `/api/v1`; có vẻ scaffold residue/diagnostic endpoint (`backend/src/app.controller.ts:4-10`).
9. Backend README vẫn gần Nest starter boilerplate; không dùng nó làm architecture/ops source of truth (`backend/README.md`).

### 18.4 Data consistency risks

- Denormalized story/author/comment counters và daily analytics có maintenance scripts: drift là anticipated failure mode.
- Async outbox/queue là at-least-once: duplicate delivery phải được coi là bình thường.
- Polymorphic `Report`/`ModerationAction` phụ thuộc raw SQL constraints; Prisma schema review một mình không đủ.
- Category/tag case-insensitive uniqueness và pending pen-name uniqueness nằm trong migration indexes, dễ bị bỏ sót khi viết seed/script.

### 18.5 Scope claims cần đọc như intent

`backend/ops/production/PRODUCTION_V1_SCOPE.md` hiện đánh dấu 16 feature required “ready” theo manifest, gồm chapter scheduling; weekly ReadingSession stats, ChapterVersion workflow, personalized recommendations và heuristic goals/trends vẫn deferred. Đây là repo-declared scope/gate, không chứng minh feature live đã pass acceptance test.

---

## 19. Các vùng uncertainty/gap nên xác minh trước thay đổi

- Môi trường/VPS nào dùng `compose.production.yml` so với `compose.vps.yml`.
- Current deployed SHA, image digest, migration state và current/previous release pointer.
- Redis persistence/maxmemory/eviction thực tế; worker role/count/concurrency live.
- SMTP provider, DKIM/SPF/DMARC, mail deliverability và queue backlog.
- Cloudinary webhook URL/secret và unprocessed/dead-letter inbox rows.
- Restic repository/retention, last successful backup và last restore drill.
- AI providers/models/rate limits enabled live; encrypted key rotation state.
- Metrics/OTel/Loki/Tempo/Alertmanager receivers live.
- CORS/trusted proxy/cookie Secure/SameSite values live.
- API matrix generator coverage đối với frontend route names.
- Có chủ ý giữ root Hello World endpoint, stale media middleware path và timeout config drift hay không.
- Queue `media` là reserved hay implementation missing; chapter scheduling worker cần được xác minh live.

Để xác minh live, cần evidence runtime như `docker compose ps`, image digest, migration status, `/api/v1/health/ready`, worker/queue/outbox/inbox metrics, logs/request ID, `docker stats`, backup/restore logs. Không substitute các lệnh này bằng đọc config.

---

## 20. Task-oriented reading paths

### 20.1 Sửa login/refresh/logout/cookie/CSRF

1. `backend/src/modules/auth/presentation/http/controllers/auth-token.controller.ts`
2. `backend/src/modules/auth/application/commands/login` và `refresh-token`
3. refresh cookie/CSRF guards/adapters trong auth infrastructure/presentation
4. `backend/src/config/auth.config.ts`, `environment.validation.ts`
5. `frontend/src/app/core/http/api.interceptor.ts`
6. `frontend/src/app/core/auth/{auth.store,auth-refresh.service,auth-refresh-coordinator.service,auth-session-hint.store,token.store}.ts`
7. auth unit/integration/E2E + frontend interceptor/store specs

### 20.2 Sửa RBAC/role/permission

1. controller decorators + frontend route guards
2. `backend/src/common/guards`
3. `backend/src/modules/auth/auth-authorization.module.ts` và authorization cache adapter
4. `backend/prisma/seed.ts`
5. schema role joins và migration nếu thêm code
6. admin user/author lifecycle tests

### 20.3 Sửa story/chapter publication

1. author/public/admin controllers ở stories/chapters
2. relevant command handler/domain policy
3. `prisma-story.persistence.ts` / `prisma-chapter.persistence.ts`
4. `Story`, `StorySubmission`, `Chapter`, `OutboxEvent` schema + initial constraints migration
5. notification/AI contracts và workers nếu publish behavior đổi
6. story integration/E2E, author studio repository/store/pages

### 20.4 Sửa author application/lifecycle

1. two author-application controllers
2. draft/submit/approve/reject handlers
3. `AuthorApplicationLifecyclePolicy`
4. `prisma-author-application.persistence.ts`
5. pending pen-name unique migration + role/profile/lifecycle schema
6. account application + admin application frontend features/tests

### 20.5 Sửa media/Cloudinary

1. `media.controller.ts`, `cloudinary-webhook.controller.ts`
2. media upload policies/registry và command handlers
3. Cloudinary adapter, inbox worker, persistence
4. `MediaAsset`, `ChapterMedia`, `InboundWebhookEvent` + media migrations
5. frontend upload services cho avatar/application/author profile/story
6. nhớ direct-upload + confirm + webhook là ba nhánh khác nhau

### 20.6 Sửa comments/moderation/reports

1. public/write/comments controllers
2. comment policy + handlers + Prisma adapter
3. moderation module (không deep-import internals comments)
4. reports module và polymorphic DB constraints
5. comment/moderation integration tests + public/admin frontend

### 20.7 Sửa analytics

1. reader/author analytics controllers
2. ingestion handler/request event shapes
3. raw event persistence + dispatcher/recovery/aggregation adapters
4. worker processors/schedulers
5. analytics migrations/indexes and author portal charts
6. kỳ vọng eventual consistency, dedupe và time buckets

### 20.8 Sửa AI/chat/translation

1. controller tương ứng: connections/chat/policy/profile/usage/translation
2. application manager/handler + protocol port
3. native protocol adapters/model discovery/capability probe
4. encrypted connection persistence + transitional fields
5. usage/rate-limit/fallback policies
6. AI worker/outbox auto-translation path
7. AI integration/E2E + frontend account/admin/author translation features

### 20.9 Sửa deploy/ops

1. `backend/ops/production/PRODUCTION_RUNBOOK.md`
2. `backend/compose.production.yml`
3. `backend/ops/production/Caddyfile`
4. `.github/workflows/ci.yml`, image workflows, deploy/rollback
5. scripts invoked by workflow, không chỉ YAML
6. xác minh immutable SHA, backward DB compatibility và recovery behavior

---

## 21. Key files theo mức leverage

Nếu chỉ có thời gian đọc 25 file/nhóm:

1. `backend/src/app.module.ts`
2. `backend/src/worker.module.ts`
3. `backend/src/bootstrap/application.bootstrap.ts`
4. `backend/src/bootstrap/application-configurator.ts`
5. `backend/src/common/guards/common-guards.module.ts`
6. `backend/src/common/pipes/app-validation.pipe.ts`
7. `backend/src/common/filters/all-exceptions.filter.ts`
8. `backend/src/common/interceptors/response-envelope.interceptor.ts`
9. `backend/src/config/environment.validation.ts`
10. `backend/src/modules/auth/auth.module.ts` và submodules
11. `backend/src/modules/auth/application/commands/login/login.command-handler.ts`
12. `backend/src/modules/auth/application/commands/refresh-token/refresh-token.command-handler.ts`
13. `backend/src/modules/stories/stories.module.ts`
14. `backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts`
15. `backend/src/infrastructure/queue/outbox/outbox-dispatcher.service.ts`
16. `backend/prisma/schema.prisma`
17. `backend/prisma/seed.ts`
18. relevant migration SQL
19. `frontend/src/app/app.routes.ts` + `routes/*.routes.ts`
20. `frontend/src/app/app.config.ts`
21. `frontend/src/app/core/http/api.interceptor.ts`
22. `frontend/src/app/core/auth/auth.store.ts`
23. `frontend/src/app/core/config/app-runtime-config.server.ts`
24. `backend/compose.production.yml` + runbook/Caddy
25. `.github/workflows/ci.yml` + deploy/rollback workflows

---

## 22. Glossary nội bộ

- **TruyenHub**: app name hiển thị/runtime config; repo folder là `Quan-ly-truyen`.
- **API prefix**: `/api/v1`; metrics là ngoại lệ `/internal/metrics`.
- **Application handler**: class `*CommandHandler`/`*QueryHandler` thực thi use case.
- **Port**: interface/token ở application; adapter concrete ở infrastructure.
- **Active author**: user có AUTHOR role chưa đủ; lifecycle author còn phải active qua `ActiveAuthorGuard`.
- **Story submission**: row review riêng, không đồng nhất với `Story.status`.
- **Upload intent**: backend cấp signed direct-upload contract; không phải multipart upload qua Nest.
- **Outbox**: durable outbound event trong PostgreSQL, worker claim/enqueue.
- **Inbox**: durable inbound webhook event, worker retry/apply.
- **Session hint**: boolean browser hint rằng refresh cookie có thể tồn tại; không phải credential.
- **Token family**: refresh token rotation lineage; reuse revoke family.
- **Runtime auth config**: password/reset/CSRF policy frontend fetch trước bootstrap.
- **Reader analytics raw event**: ingest record trước aggregate; author stats có delay.
- **System AI connection**: `AiConnection.userId=null`, do admin quản lý; user connection có owner.
- **Expand-contract**: schema/app rollout giữ tương thích current/previous để rollback app không cần rollback DB.
- **Production gate**: scripts/preflight/postdeploy checks; không đồng nghĩa live đang pass nếu chưa chạy/đọc kết quả.

---

## 23. Kết luận handoff

Repo có architecture discipline cao hơn mức một Nest/Angular CRUD app thông thường: boundary checkers, global contract, security-focused auth, DB raw constraints, outbox/inbox, worker split, immutable deploy và recovery tooling. Phần khó không nằm ở việc tìm controller, mà ở các cross-cutting invariants:

- auth phụ thuộc session/version/cookie/CSRF/Redis/browser bootstrap;
- publication phát side effects async;
- media có direct upload + confirm + webhook reconciliation;
- analytics/counters eventual và có maintenance;
- production migration phải rollback-compatible;
- frontend route permission và backend permission cần thay đổi đồng bộ.

Agent tiếp theo nên bắt đầu bằng task-oriented reading path ở section 20, giữ phân biệt **repo evidence** với **live evidence**, và không dùng docs generated/starter README thay cho current route/schema/code khi chúng xung đột.
