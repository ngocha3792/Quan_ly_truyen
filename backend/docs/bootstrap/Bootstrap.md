# Bootstrap Architecture

> Tài liệu kiến trúc khởi động ứng dụng backend của dự án **Quản lý truyện**.
>
> Phạm vi: `backend/src/bootstrap`, `backend/src/main.ts` và các thành phần được kích hoạt trong quá trình NestJS khởi động.

---

## 1. Mục đích của tài liệu

Tài liệu này giúp thành viên mới hiểu:

- Bootstrap là gì và tại sao dự án cần một tầng bootstrap riêng.
- Luồng khởi động của backend từ `main.ts` đến khi HTTP server sẵn sàng nhận request.
- Trách nhiệm của từng file trong `backend/src/bootstrap`.
- Thành phần nào được đăng ký trong bootstrap và thành phần nào phải nằm trong `AppModule`.
- Cách tránh đăng ký trùng middleware, interceptor, filter và pipe.
- Các biến môi trường liên quan đến quá trình khởi động.
- Cách kiểm thử và xử lý sự cố khi ứng dụng không khởi động được.

Đây là tài liệu định hướng triển khai. Khi mã nguồn thay đổi, tài liệu này phải được cập nhật cùng pull request.

---

## 2. Trạng thái hiện tại của dự án

Tại thời điểm viết tài liệu, backend đang khởi động trực tiếp trong `src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

Cách này chạy được nhưng chưa kích hoạt đầy đủ các thành phần đã chuẩn bị trong `src/common`, ví dụ:

- `AppValidationPipe` chưa được đăng ký global.
- `CommonFiltersModule` chưa được import vào `AppModule` nên `AllExceptionsFilter` chưa hoạt động global.
- Chưa cấu hình global API prefix bằng `API_PREFIX`.
- Chưa cấu hình CORS cho Angular frontend.
- Chưa bật shutdown hooks.
- Chưa có startup logging và xử lý lỗi bootstrap tập trung.

Folder `backend/src/bootstrap` trong tài liệu này là **kiến trúc đích cần triển khai**, không phải mô tả rằng toàn bộ các file đã tồn tại.

---

## 3. Bootstrap là gì?

Bootstrap là tầng chịu trách nhiệm **tạo, cấu hình và khởi chạy Nest application**.

Bootstrap không chứa nghiệp vụ quản lý truyện. Nó chỉ điều phối các cấu hình cấp ứng dụng như:

- Tạo `INestApplication` từ `AppModule`.
- Đặt global API prefix.
- Đăng ký global pipe.
- Cấu hình CORS.
- Bật graceful shutdown.
- Khởi tạo Swagger khi được cho phép.
- Đọc host và port để mở HTTP server.
- Log trạng thái khởi động.
- Xử lý lỗi nếu ứng dụng không thể khởi động.

Mục tiêu cuối cùng là giữ `main.ts` thật mỏng:

```ts
import { runApplication } from './bootstrap';

void runApplication();
```

---

## 4. Phân tách trách nhiệm

| Thành phần | Trách nhiệm |
|---|---|
| `main.ts` | Entry point của Node.js; gọi hàm bootstrap |
| `src/bootstrap` | Tạo, cấu hình và chạy Nest application |
| `AppModule` | Khai báo dependency graph của ứng dụng |
| `src/config` | Đọc, chuẩn hóa và kiểm tra biến môi trường |
| `common/middlewares` | Xử lý request trước controller |
| `common/guards` | Authentication và authorization |
| `common/interceptors` | Logging, timeout và response envelope quanh handler |
| `common/pipes` | Parse, transform và validate input |
| `common/filters` | Chuẩn hóa exception thành HTTP response |
| `modules/*` | Nghiệp vụ quản lý người dùng, tác giả, truyện, chương và admin |

Nguyên tắc quan trọng:

> Bootstrap cấu hình **ứng dụng đang chạy**; `AppModule` cấu hình **đồ thị dependency injection**.

---

## 5. Cấu trúc folder đề xuất

Cấu trúc phù hợp với giai đoạn hiện tại:

```text
backend/src/bootstrap/
├── application.bootstrap.ts
├── application-configurator.ts
├── cors.bootstrap.ts
├── shutdown.bootstrap.ts
├── swagger.bootstrap.ts
└── index.ts
```

Ý nghĩa:

| File | Vai trò |
|---|---|
| `application.bootstrap.ts` | Tạo app, gọi các configurator và mở HTTP server |
| `application-configurator.ts` | Global prefix, validation pipe và cấu hình chung của Nest app |
| `cors.bootstrap.ts` | Cấu hình origin, credentials, methods và headers |
| `shutdown.bootstrap.ts` | Bật lifecycle khi process nhận tín hiệu dừng |
| `swagger.bootstrap.ts` | Tạo OpenAPI document và Swagger UI; chỉ dùng khi đã cài dependency |
| `index.ts` | Public exports của folder bootstrap |

Không nên tách thêm file nếu chưa có logic thực tế. Ví dụ chưa cần tạo `security.bootstrap.ts`, `logger.bootstrap.ts` hoặc `body-parser.bootstrap.ts` khi chúng chỉ là file rỗng.

---

## 6. Luồng khởi động tổng thể

```mermaid
flowchart TD
    A[Node.js chạy src/main.ts] --> B[runApplication]
    B --> C[NestFactory.create AppModule]
    C --> D[Nest xây dependency graph]
    D --> E[Khởi tạo modules và global providers]
    E --> F[configureApplication]
    F --> G[Đặt API prefix]
    G --> H[Đăng ký AppValidationPipe]
    H --> I[configureCors]
    I --> J[configureShutdown]
    J --> K{Swagger được bật?}
    K -- Có --> L[configureSwagger]
    K -- Không --> M[Không tạo Swagger UI]
    L --> N[app.listen]
    M --> N
    N --> O[HTTP server sẵn sàng]
```

Khi một request đến, luồng xử lý dự kiến là:

```mermaid
flowchart LR
    A[HTTP Request] --> B[Express / Nest middleware]
    B --> C[Guards]
    C --> D[Interceptors trước handler]
    D --> E[Pipes và validation]
    E --> F[Controller]
    F --> G[Service / Use case]
    G --> H[Interceptors sau handler]
    H --> I[HTTP Response]
    F -. Exception .-> J[AllExceptionsFilter]
    G -. Exception .-> J
    D -. Exception .-> J
    J --> I
```

---

## 7. `application.bootstrap.ts`

### 7.1. Trách nhiệm

File này là bộ điều phối chính của quá trình khởi động:

1. Tạo Nest application từ `AppModule`.
2. Gọi các hàm cấu hình theo đúng thứ tự.
3. Mở HTTP server.
4. Ghi log URL và environment.
5. Bắt lỗi khởi động ở một nơi duy nhất.

### 7.2. Code đề xuất

```ts
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '@/app.module';

import { configureApplication } from './application-configurator';
import { configureCors } from './cors.bootstrap';
import { configureShutdown } from './shutdown.bootstrap';
// Chỉ import sau khi dự án đã cài @nestjs/swagger.
// import { configureSwagger } from './swagger.bootstrap';

const logger = new Logger('Bootstrap');

export async function bootstrapApplication(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  configureApplication(app);
  configureCors(app);
  configureShutdown(app);

  // Chỉ bật khi @nestjs/swagger đã được cài.
  // configureSwagger(app);

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  logger.log(`Application: ${await app.getUrl()}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

export async function runApplication(): Promise<void> {
  try {
    await bootstrapApplication();
  } catch (error: unknown) {
    const stack = error instanceof Error ? error.stack : undefined;
    const message =
      error instanceof Error ? error.message : 'Unknown bootstrap error';

    logger.error(`Application bootstrap failed: ${message}`, stack);
    process.exitCode = 1;
  }
}
```

### 7.3. Vì sao dùng `process.exitCode`?

Không nên gọi `process.exit(1)` ngay trong catch nếu không cần thiết. `process.exitCode = 1` cho phép Node.js kết thúc sau khi:

- Logger đã flush dữ liệu.
- Các stream đang chờ được hoàn tất.
- Tài nguyên có cơ hội đóng đúng cách.

### 7.4. Thứ tự cấu hình

Thứ tự nên ổn định:

```text
create app
→ configureApplication
→ configureCors
→ configureShutdown
→ configureSwagger (optional)
→ listen
```

Không gọi `listen()` trước khi hoàn tất cấu hình, vì sau thời điểm đó server có thể đã nhận request.

---

## 8. `application-configurator.ts`

### 8.1. Trách nhiệm

File này chứa cấu hình chung áp dụng cho toàn bộ HTTP application:

- Global API prefix.
- Global validation pipe.
- Cấu hình Express adapter nhỏ và thực sự cần thiết.

### 8.2. Code đề xuất cho giai đoạn hiện tại

```ts
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { API_PREFIX } from '@/common/constants';
import { AppValidationPipe } from '@/common/pipes';

export function configureApplication(
  app: INestApplication,
): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new AppValidationPipe());

  configureTrustProxy(app as NestExpressApplication);
}

function configureTrustProxy(app: NestExpressApplication): void {
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  }
}
```

### 8.3. Global prefix

Dự án đã có constants:

```ts
export const API_GLOBAL_PREFIX = 'api';
export const API_VERSION = 'v1';
export const API_PREFIX = `${API_GLOBAL_PREFIX}/${API_VERSION}`;
```

Vì vậy bootstrap phải sử dụng:

```ts
app.setGlobalPrefix(API_PREFIX);
```

Kết quả:

```text
/api/v1/...
```

Không hardcode lại `'api/v1'` trong bootstrap.

### 8.4. Validation pipe

`AppValidationPipe` đã tồn tại tại:

```text
src/common/pipes/app-validation.pipe.ts
```

Nó đang cấu hình:

- `transform: true`
- `whitelist: true`
- `forbidNonWhitelisted: true`
- Không dừng ở validation error đầu tiên.
- Ẩn `target` và `value` khỏi validation error.

Bootstrap chỉ kích hoạt pipe:

```ts
app.useGlobalPipes(new AppValidationPipe());
```

Bootstrap không nên viết lại toàn bộ validation options.

### 8.5. `trust proxy`

Chỉ bật `trust proxy` khi ứng dụng chạy sau reverse proxy đáng tin cậy như Nginx, ingress controller hoặc load balancer.

Nếu bật sai, client có thể giả mạo header forwarded và ảnh hưởng đến:

- Client IP.
- Secure cookie behavior.
- Audit log.
- Rate limiting.

Biến môi trường:

```env
TRUST_PROXY=false
```

Trong production cần xác định rõ topology hạ tầng trước khi chuyển thành `true`.

### 8.6. Body parser

Nest đã bật body parser mặc định. Không nên đăng ký thêm `express.json()` chỉ để “cho đủ cấu trúc”, vì có thể tạo parser trùng hoặc cấu hình không được áp dụng như mong đợi.

Khi dự án thực sự cần custom body limit, tạo app với:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  bodyParser: false,
});
```

Sau đó bootstrap mới đăng ký parser một lần:

```ts
import { json, urlencoded } from 'express';

app.use(json({ limit: process.env.JSON_BODY_LIMIT ?? '2mb' }));
app.use(
  urlencoded({
    extended: true,
    limit: process.env.URL_ENCODED_BODY_LIMIT ?? '2mb',
  }),
);
```

Không áp dụng thay đổi này nếu chưa có yêu cầu cụ thể và test upload/webhook đầy đủ.

---

## 9. `cors.bootstrap.ts`

### 9.1. Trách nhiệm

CORS cho phép Angular frontend gọi backend từ một origin khác.

Ví dụ trong development:

```text
Frontend: http://localhost:4200
Backend:  http://localhost:3000
```

Trình duyệt coi đây là hai origin khác nhau, do đó backend phải phản hồi CORS headers phù hợp.

### 9.2. Code đề xuất

```ts
import type { INestApplication } from '@nestjs/common';

import { HTTP_HEADERS } from '@/common/constants';

const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:4200';

export function configureCors(app: INestApplication): void {
  if (process.env.CORS_ENABLED === 'false') {
    return;
  }

  const allowedOrigins = parseAllowedOrigins(
    process.env.CORS_ALLOWED_ORIGINS,
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      HTTP_HEADERS.AUTHORIZATION,
      HTTP_HEADERS.CONTENT_TYPE,
      HTTP_HEADERS.ACCEPT_LANGUAGE,
      HTTP_HEADERS.REQUEST_ID,
      HTTP_HEADERS.CORRELATION_ID,
      HTTP_HEADERS.IDEMPOTENCY_KEY,
    ],
    exposedHeaders: [
      HTTP_HEADERS.REQUEST_ID,
      HTTP_HEADERS.CORRELATION_ID,
      HTTP_HEADERS.RETRY_AFTER,
    ],
    maxAge: 86_400,
  });
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) {
    return [DEFAULT_DEVELOPMENT_ORIGIN];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
```

### 9.3. Production rule

Không dùng wildcard origin cùng credentials:

```ts
// Không nên dùng cho hệ thống có cookie hoặc credential.
app.enableCors({
  origin: '*',
  credentials: true,
});
```

Production phải khai báo danh sách origin cụ thể:

```env
CORS_ALLOWED_ORIGINS=https://example.com,https://admin.example.com
```

### 9.4. Headers

`allowedHeaders` là những header frontend được phép gửi.

`exposedHeaders` là những response header JavaScript phía frontend được phép đọc.

Dự án sử dụng request tracing nên cần expose:

- `x-request-id`
- `x-correlation-id`
- `retry-after`

Nếu sau này thêm `content-language` vào `HTTP_HEADERS`, có thể expose header này tại đây.

---

## 10. `shutdown.bootstrap.ts`

### 10.1. Trách nhiệm

Bật graceful shutdown để Nest gọi lifecycle hooks khi process nhận tín hiệu dừng.

```ts
import type { INestApplication } from '@nestjs/common';

export function configureShutdown(app: INestApplication): void {
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}
```

### 10.2. Tại sao cần graceful shutdown?

Khi deploy, container hoặc server thường gửi `SIGTERM` trước khi dừng process. Ứng dụng cần thời gian để:

- Ngừng nhận request mới.
- Đóng kết nối Prisma/PostgreSQL.
- Đóng Redis hoặc message queue.
- Flush log và telemetry.
- Hoàn thành lifecycle hooks.

Các provider có thể triển khai:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class ExampleResource implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Đóng connection hoặc giải phóng tài nguyên.
  }
}
```

### 10.3. Không đăng ký signal handler trùng

Nếu đã dùng:

```ts
app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
```

không nên viết thêm một signal handler chỉ để gọi `app.close()`:

```ts
// Tránh làm nếu không có yêu cầu đặc biệt.
process.on('SIGTERM', async () => {
  await app.close();
});
```

Đăng ký trùng có thể khiến shutdown chạy nhiều lần hoặc khó kiểm soát thứ tự.

---

## 11. `swagger.bootstrap.ts`

### 11.1. Trạng thái dependency

Hiện `package.json` chưa có:

```text
@nestjs/swagger
swagger-ui-express
```

Vì vậy không được thêm import Swagger vào code đang build trước khi cài dependency.

Cài đặt khi nhóm quyết định triển khai API documentation:

```bash
npm install @nestjs/swagger swagger-ui-express
```

### 11.2. Code đề xuất

```ts
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_PREFIX, APP_NAME } from '@/common/constants';

export function configureSwagger(app: INestApplication): void {
  if (process.env.SWAGGER_ENABLED !== 'true') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setDescription('API quản lý và đọc truyện')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addTag('Auth')
    .addTag('Users')
    .addTag('Authors')
    .addTag('Stories')
    .addTag('Chapters')
    .addTag('Admin')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  });
}
```

Swagger UI dự kiến:

```text
GET /api/v1/docs
```

### 11.3. Quy tắc môi trường

Development:

```env
SWAGGER_ENABLED=true
```

Production:

```env
SWAGGER_ENABLED=false
```

Swagger không nên mặc định public trong production. Nếu bắt buộc phải bật, cần bảo vệ bằng network policy, authentication hoặc private ingress.

---

## 12. `index.ts`

`index.ts` chỉ export public API của folder:

```ts
export * from './application.bootstrap';
export * from './application-configurator';
export * from './cors.bootstrap';
export * from './shutdown.bootstrap';

// Chỉ export khi Swagger đã được cài và file có thể compile.
// export * from './swagger.bootstrap';
```

Không export helper nội bộ nếu module khác không cần sử dụng.

---

## 13. `main.ts` sau khi refactor

```ts
import { runApplication } from './bootstrap';

void runApplication();
```

`main.ts` không nên chứa:

- CORS options.
- Swagger document builder.
- Validation options.
- Middleware registration.
- Business logic.
- Prisma queries.
- Seed logic.

Mọi cấu hình khởi động phải đi qua folder `bootstrap` hoặc config module tương ứng.

---

## 14. Thay đổi cần có trong `AppModule`

### 14.1. Global exception filter

`CommonFiltersModule` đã đăng ký:

```ts
{
  provide: APP_FILTER,
  useClass: AllExceptionsFilter,
}
```

Nhưng module này hiện chưa được import vào `AppModule`.

Cần thêm:

```ts
import { CommonFiltersModule } from './common/filters';

@Module({
  imports: [
    CommonMiddlewaresModule.register({
      // Options hiện có của dự án.
    }),
    CommonInterceptorsModule,
    CommonFiltersModule,
  ],
})
export class AppModule implements NestModule {
  // ...
}
```

### 14.2. Vì sao filter nằm trong `AppModule`?

`AllExceptionsFilter` phụ thuộc `ExceptionNormalizer` qua dependency injection. Đăng ký bằng `APP_FILTER` giúp Nest tạo filter cùng dependency graph.

Không nên tạo thủ công trong bootstrap:

```ts
// Tránh đăng ký thủ công như sau.
app.useGlobalFilters(new AllExceptionsFilter(/* dependencies */));
```

### 14.3. Global interceptors

`CommonInterceptorsModule` hiện đã đăng ký bằng `APP_INTERCEPTOR`:

- `LoggingInterceptor`
- `TimeoutInterceptor`
- `ResponseEnvelopeInterceptor`

Vì vậy bootstrap **không được** đăng ký lại:

```ts
// Không làm như sau.
app.useGlobalInterceptors(
  new LoggingInterceptor(),
  new TimeoutInterceptor(),
  new ResponseEnvelopeInterceptor(),
);
```

Nếu đăng ký hai lần, request có thể:

- Bị log hai lần.
- Bị bọc response hai lần.
- Chạy hai timeout chain.

### 14.4. Middleware

`AppModule.configure()` hiện đăng ký:

- `RequestContextMiddleware`
- `LocaleMiddleware`
- `MaintenanceModeMiddleware`
- `JsonContentTypeMiddleware`

Các middleware này tiếp tục ở `AppModule`; bootstrap không đăng ký lại bằng `app.use()`.

Lý do: chúng là Nest middleware có dependency injection và option từ `CommonMiddlewaresModule.register()`.

---

## 15. Thành phần nào đăng ký ở đâu?

| Thành phần | Nơi đăng ký đúng | Cách đăng ký |
|---|---|---|
| Global prefix | Bootstrap | `app.setGlobalPrefix()` |
| Global validation pipe | Bootstrap | `app.useGlobalPipes()` |
| CORS | Bootstrap | `app.enableCors()` |
| Shutdown hooks | Bootstrap | `app.enableShutdownHooks()` |
| Swagger | Bootstrap | `SwaggerModule.setup()` |
| Nest middleware có DI | `AppModule.configure()` | `consumer.apply()` |
| Global interceptor có DI | Module | `APP_INTERCEPTOR` |
| Global filter có DI | Module | `APP_FILTER` |
| Global guard có DI | Module | `APP_GUARD` |
| Config values | Config module/service | `ConfigService` hoặc validated config |
| Business modules | `AppModule` | `imports: []` |

---

## 16. Biến môi trường bootstrap

### 16.1. Biến cần thiết

| Biến | Mặc định đề xuất | Ý nghĩa |
|---|---:|---|
| `NODE_ENV` | `development` | Môi trường chạy ứng dụng |
| `HOST` | `0.0.0.0` | Interface mà HTTP server bind |
| `PORT` | `3000` | HTTP port |
| `CORS_ENABLED` | `true` | Bật/tắt CORS |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` | Danh sách origin, phân tách bằng dấu phẩy |
| `TRUST_PROXY` | `false` | Tin tưởng reverse proxy headers |
| `SWAGGER_ENABLED` | `false` | Bật Swagger UI sau khi cài dependency |
| `JSON_BODY_LIMIT` | `2mb` | Chỉ dùng khi custom body parser |
| `URL_ENCODED_BODY_LIMIT` | `2mb` | Chỉ dùng khi custom body parser |

### 16.2. Ví dụ `.env.example`

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

CORS_ENABLED=true
CORS_ALLOWED_ORIGINS=http://localhost:4200
TRUST_PROXY=false

SWAGGER_ENABLED=false

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

### 16.3. Quy tắc bảo mật

File `.env.example` chỉ chứa placeholder, tuyệt đối không chứa credential thật.

Nếu một credential thật từng được commit:

1. Thu hồi hoặc rotate credential ngay.
2. Thay bằng placeholder trong repository.
3. Kiểm tra lịch sử Git và secret scanning.
4. Không chỉ xóa khỏi commit mới rồi tiếp tục sử dụng credential cũ.

---

## 17. Config module trong tương lai

Dự án hiện dùng `process.env` trực tiếp và chưa có `@nestjs/config`.

Khi số lượng biến môi trường tăng, nên bổ sung:

```text
src/config/
├── app.config.ts
├── cors.config.ts
├── database.config.ts
├── auth.config.ts
├── environment.validation.ts
├── config.module.ts
└── index.ts
```

Sau đó bootstrap lấy config qua DI:

```ts
const configService = app.get(ConfigService);
const port = configService.getOrThrow<number>('app.port');
```

Lợi ích:

- Fail fast khi thiếu biến bắt buộc.
- Parse kiểu dữ liệu một lần.
- Tránh `process.env` rải rác trong code.
- Dễ test cấu hình.
- Có một source of truth cho environment.

Tuy nhiên không nên cài và tạo config architecture chỉ để làm folder đầy đủ. Triển khai khi nhóm sẵn sàng refactor toàn bộ environment access.

---

## 18. Health check và readiness

Bootstrap không tự triển khai health endpoint, nhưng deployment cần endpoint để xác định trạng thái ứng dụng.

Đề xuất:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

- `live`: process còn hoạt động.
- `ready`: ứng dụng sẵn sàng phục vụ, kết nối thiết yếu hoạt động.

`MaintenanceModeMiddleware` hiện cho phép path `/api/v1/health`. Khi đổi sang hai endpoint trên, cần cập nhật `allowedPaths` tương ứng.

Không thực hiện truy vấn nặng trong liveness check vì hệ thống orchestrator có thể gọi rất thường xuyên.

---

## 19. Logging khi bootstrap

Bootstrap log tối thiểu:

- URL server.
- Environment.
- Swagger status khi có.
- Lỗi khởi động với stack trace.

Không log:

- `DATABASE_URL`.
- JWT secret.
- Password.
- Maintenance bypass token.
- Full environment object.

Ví dụ log hợp lệ:

```text
[Nest] LOG [Bootstrap] Application: http://0.0.0.0:3000
[Nest] LOG [Bootstrap] Environment: development
```

Ví dụ log không hợp lệ:

```text
Database URL: postgresql://user:password@host/database
JWT secret: super-secret
```

---

## 20. Error handling trong quá trình khởi động

Các lỗi có thể xảy ra trước `listen()`:

- Module không resolve được dependency.
- Environment không hợp lệ.
- Prisma hoặc provider khởi tạo thất bại.
- Port không hợp lệ.
- Import dependency tùy chọn chưa được cài.

Các lỗi có thể xảy ra tại `listen()`:

- Port đã được sử dụng (`EADDRINUSE`).
- Không có quyền bind port (`EACCES`).
- Host không hợp lệ.

`runApplication()` phải:

1. Ghi log message và stack.
2. Đặt exit code khác 0.
3. Không nuốt lỗi rồi để process ở trạng thái không phục vụ được.

---

## 21. Testing strategy

### 21.1. Unit test configurator

Mỗi configurator là function nhỏ, có thể test bằng mock app.

Ví dụ:

```ts
import { API_PREFIX } from '@/common/constants';

import { configureApplication } from './application-configurator';

describe('configureApplication', () => {
  it('sets the API prefix and global validation pipe', () => {
    const app = {
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
      set: jest.fn(),
    };

    configureApplication(app as never);

    expect(app.setGlobalPrefix).toHaveBeenCalledWith(API_PREFIX);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
  });
});
```

### 21.2. E2E test

E2E test cần kiểm tra:

- `/api/v1/...` hoạt động.
- Route không prefix trả về 404.
- DTO không hợp lệ trả response validation chuẩn.
- Response thành công được envelope một lần.
- Exception được filter chuẩn hóa một lần.
- CORS preflight hoạt động với frontend origin được phép.
- Request ID và correlation ID xuất hiện đúng.

### 21.3. Không gọi `listen()` trong phần lớn test

Test module và request có thể dùng:

```ts
const app = moduleFixture.createNestApplication();
configureApplication(app);
await app.init();
```

Chỉ test thực sự liên quan network binding mới cần `app.listen()`.

---

## 22. Checklist triển khai

### Giai đoạn 1 — Bắt buộc

- [ ] Tạo `src/bootstrap/application.bootstrap.ts`.
- [ ] Tạo `src/bootstrap/application-configurator.ts`.
- [ ] Tạo `src/bootstrap/cors.bootstrap.ts`.
- [ ] Tạo `src/bootstrap/shutdown.bootstrap.ts`.
- [ ] Tạo `src/bootstrap/index.ts`.
- [ ] Refactor `src/main.ts` chỉ gọi `runApplication()`.
- [ ] Dùng `API_PREFIX` cho global prefix.
- [ ] Kích hoạt `AppValidationPipe` global.
- [ ] Import `CommonFiltersModule` trong `AppModule`.
- [ ] Không đăng ký lại `CommonInterceptorsModule` components trong bootstrap.
- [ ] Không đăng ký lại Nest middlewares bằng `app.use()`.

### Giai đoạn 2 — Kiểm thử

- [ ] Chạy `npm run build`.
- [ ] Chạy `npm run lint`.
- [ ] Chạy `npm run test`.
- [ ] Chạy `npm run test:e2e`.
- [ ] Kiểm tra Angular frontend gọi được backend qua CORS.
- [ ] Kiểm tra validation response.
- [ ] Kiểm tra exception response.
- [ ] Kiểm tra shutdown bằng `SIGTERM` trong môi trường local/container.

### Giai đoạn 3 — Tùy chọn

- [ ] Cài `@nestjs/swagger` và `swagger-ui-express`.
- [ ] Tạo `swagger.bootstrap.ts`.
- [ ] Bật Swagger chỉ trong environment phù hợp.
- [ ] Bổ sung config module và environment validation.
- [ ] Bổ sung health/readiness endpoints.
- [ ] Cấu hình custom body parser khi có yêu cầu thực tế.

---

## 23. Definition of Done

Bootstrap được xem là hoàn tất khi:

1. `main.ts` chỉ gọi public bootstrap function.
2. Server chạy tại host và port được cấu hình.
3. Tất cả API có prefix `/api/v1`.
4. DTO validation hoạt động global.
5. `AllExceptionsFilter` hoạt động global.
6. Mỗi interceptor chỉ chạy một lần.
7. CORS cho phép đúng Angular origin.
8. `SIGTERM` kích hoạt shutdown lifecycle.
9. Build, lint, unit test và e2e test vượt qua.
10. Không có secret thật trong source code hoặc `.env.example`.

---

## 24. Các lỗi kiến trúc thường gặp

### 24.1. Đăng ký interceptor hai lần

Sai:

```ts
// Đã có APP_INTERCEPTOR trong module nhưng lại đăng ký thêm ở bootstrap.
app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
```

Hậu quả: response có thể bị bọc hai lớp.

### 24.2. Đăng ký filter thủ công dù filter cần DI

Sai:

```ts
app.useGlobalFilters(new AllExceptionsFilter(/* tự tạo dependencies */));
```

Đúng: import `CommonFiltersModule` để Nest resolve dependencies.

### 24.3. Hardcode API prefix

Sai:

```ts
app.setGlobalPrefix('api/v1');
```

Đúng:

```ts
app.setGlobalPrefix(API_PREFIX);
```

### 24.4. Import Swagger trước khi cài package

Sai: thêm file có import `@nestjs/swagger` nhưng không cài dependency, khiến build thất bại.

### 24.5. Cho business logic vào bootstrap

Sai:

```ts
// Không tạo admin, seed role hoặc truy vấn truyện trong bootstrap.
await storyService.rebuildRankings();
```

Các tác vụ đó phải nằm trong migration, seed, scheduled job hoặc module nghiệp vụ phù hợp.

### 24.6. Log toàn bộ environment

Sai:

```ts
console.log(process.env);
```

Hậu quả: secret có thể xuất hiện trong log aggregation.

---

## 25. Quy tắc đóng góp code bootstrap

Khi thay đổi bootstrap:

- Mỗi function chỉ đảm nhận một nhóm cấu hình rõ ràng.
- Không tạo file mới nếu logic chỉ có một hoặc hai dòng và không có xu hướng phát triển.
- Không dùng magic strings nếu constant đã tồn tại.
- Không đăng ký global component ở hai nơi.
- Mọi biến môi trường mới phải được thêm vào `.env.example` bằng placeholder.
- Mọi hành vi mới phải có test hoặc có lý do rõ ràng trong pull request.
- Thay đổi thứ tự interceptor/middleware phải được review kỹ vì có thể thay đổi hành vi toàn hệ thống.
- Dependency tùy chọn phải được cài trước khi import vào code build.

---

## 26. Cấu trúc đích sau khi triển khai

```text
backend/src/
├── bootstrap/
│   ├── application.bootstrap.ts
│   ├── application-configurator.ts
│   ├── cors.bootstrap.ts
│   ├── shutdown.bootstrap.ts
│   ├── swagger.bootstrap.ts       # optional
│   └── index.ts
├── common/
├── modules/
├── app.module.ts
└── main.ts
```

`main.ts`:

```ts
import { runApplication } from './bootstrap';

void runApplication();
```

`AppModule`:

```text
Modules + providers + controllers + Nest middleware registration
```

`bootstrap`:

```text
Application creation + runtime configuration + HTTP server startup
```

---

## 27. Tóm tắt cho người mới

Khi cần tìm nơi cấu hình một hành vi, sử dụng quy tắc sau:

- Liên quan cách server **khởi động hoặc lắng nghe** → `src/bootstrap`.
- Liên quan dependency injection hoặc global provider → module tương ứng và `AppModule`.
- Liên quan request trước controller → middleware/guard/pipe.
- Liên quan response quanh handler → interceptor.
- Liên quan exception response → filter.
- Liên quan nghiệp vụ truyện, chương, người dùng hoặc tác giả → `src/modules`.
- Liên quan environment → `src/config` khi config module được triển khai.

Bootstrap phải nhỏ, rõ trách nhiệm và không chứa nghiệp vụ. Nó là nơi ghép các cấu hình runtime lại với nhau, không phải một “common folder thứ hai”.
