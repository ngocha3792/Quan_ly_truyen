# CONFIG IMPLEMENTATION GUIDE

> Dự án: **Quản lý truyện — Backend NestJS**  
> Mục tiêu: triển khai `backend/src/config`, thay thế việc đọc `process.env` rải rác và chuẩn hóa `.env`.

---

## 1. Kết quả sau khi triển khai

Cấu trúc đích:

```text
backend/
├── .env.example
├── prisma.config.ts
├── prisma/
│   └── seed.ts
└── src/
    ├── bootstrap/
    ├── config/
    │   ├── app.config.ts
    │   ├── cors.config.ts
    │   ├── database.config.ts
    │   ├── environment.validation.ts
    │   ├── maintenance.config.ts
    │   ├── config.module.ts
    │   ├── config.types.ts
    │   └── index.ts
    ├── app.module.ts
    └── main.ts
```

Ở giai đoạn đầu, chưa cần tạo auth, mail, Redis hay storage config nếu các module đó chưa tồn tại.

---

## 2. Trước khi sửa code: xử lý credential cũ

`backend/docs/.env.example` hiện chứa một database URL có dạng credential hoàn chỉnh.

Thực hiện ngay:

1. thu hồi hoặc rotate password/token của database đó;
2. xóa giá trị khỏi lịch sử repository nếu repository đã được push;
3. kiểm tra CI logs, issue, pull request và artifact có lộ lại giá trị hay không;
4. thay file example bằng placeholder;
5. không dùng lại credential cũ dù chưa chắc nó còn hoạt động.

Git history rewrite có thể dùng công cụ như `git filter-repo`, nhưng phải phối hợp với toàn bộ người dùng repository vì commit history sẽ thay đổi.

---

## 3. Cài dependency

Dự án hiện đã có `class-transformer` và `class-validator`, nên có thể dùng chúng cho validation mà không cần thêm Joi/Zod.

Cài Nest config:

```bash
cd backend
npm install @nestjs/config
```

Sau khi cài:

```bash
npm run build
npm run test
```

---

## 4. Tạo `.env.example`

Chuyển file mẫu về root của backend:

```text
backend/.env.example
```

Nội dung giai đoạn hiện tại:

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
```

Tạo `.env` local từ file mẫu:

```bash
cp .env.example .env
```

Sau đó sửa `DATABASE_URL` theo PostgreSQL local thực tế.

---

## 5. Tạo `config.types.ts`

```ts
// src/config/config.types.ts
import type { AppEnvironment } from '@/common/enums';

export interface AppConfig {
  environment: AppEnvironment;
  host: string;
  port: number;
  publicUrl: string;
  trustProxy: boolean;
  requestTimeoutMs: number;
  jsonBodyLimit: string;
  urlEncodedBodyLimit: string;
  swaggerEnabled: boolean;
  defaultLocale: string;
  supportedLocales: readonly string[];
}

export interface DatabaseConfig {
  url: string;
}

export interface CorsConfig {
  allowedOrigins: readonly string[];
  credentials: boolean;
  maxAgeSeconds: number;
}

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  retryAfterSeconds: number;
  bypassHeaderName: string;
  bypassToken?: string;
  allowedPaths: readonly string[];
}
```

Các interface này mô tả config sau khi đã parse, không phải raw environment string.

---

## 6. Tạo helper parse và validation

### 6.1. `environment.validation.ts`

```ts
// src/config/environment.validation.ts
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

import { AppEnvironment } from '@/common/enums';

function parseBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected boolean string, received ${typeof value}`);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Expected "true" or "false", received "${value}"`);
}

function parseIntegerValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer, received "${String(value)}"`);
  }

  return parsed;
}

export class EnvironmentVariables {
  @IsEnum(AppEnvironment)
  NODE_ENV: AppEnvironment = AppEnvironment.DEVELOPMENT;

  @IsString()
  @IsNotEmpty()
  HOST = '0.0.0.0';

  @Transform(({ value }) => parseIntegerValue(value ?? 3000))
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 3000;

  @IsUrl({ require_tld: false })
  APP_PUBLIC_URL = 'http://localhost:3000';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  TRUST_PROXY = false;

  @Transform(({ value }) => parseIntegerValue(value ?? 15_000))
  @IsInt()
  @Min(100)
  @Max(120_000)
  HTTP_REQUEST_TIMEOUT_MS = 15_000;

  @IsString()
  @IsNotEmpty()
  JSON_BODY_LIMIT = '2mb';

  @IsString()
  @IsNotEmpty()
  URL_ENCODED_BODY_LIMIT = '2mb';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  SWAGGER_ENABLED = false;

  @IsString()
  @IsNotEmpty()
  DEFAULT_LOCALE = 'vi-VN';

  @IsString()
  @IsNotEmpty()
  SUPPORTED_LOCALES = 'vi-VN,en-US';

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS = 'http://localhost:4200';

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  CORS_CREDENTIALS = true;

  @Transform(({ value }) => parseIntegerValue(value ?? 86_400))
  @IsInt()
  @Min(0)
  CORS_MAX_AGE_SECONDS = 86_400;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  MAINTENANCE_MODE = false;

  @IsString()
  @IsNotEmpty()
  MAINTENANCE_MESSAGE = 'Hệ thống đang bảo trì';

  @Transform(({ value }) => parseIntegerValue(value ?? 300))
  @IsInt()
  @Min(0)
  MAINTENANCE_RETRY_AFTER_SECONDS = 300;

  @IsString()
  @IsNotEmpty()
  MAINTENANCE_BYPASS_HEADER = 'x-maintenance-key';

  @IsOptional()
  @IsString()
  MAINTENANCE_BYPASS_TOKEN?: string;
}

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const config = plainToInstance(EnvironmentVariables, rawConfig, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
    whitelist: false,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}).map(
        (message) => `${error.property}: ${message}`,
      ),
    );

    throw new Error(
      `Invalid environment configuration:\n${messages.join('\n')}`,
    );
  }

  validateCrossFieldRules(config);

  return { ...rawConfig, ...config };
}

function validateCrossFieldRules(config: EnvironmentVariables): void {
  const origins = parseCsv(config.CORS_ALLOWED_ORIGINS);

  if (config.CORS_CREDENTIALS && origins.includes('*')) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS cannot contain "*" when CORS_CREDENTIALS=true',
    );
  }

  const supportedLocales = parseCsv(config.SUPPORTED_LOCALES);

  if (!supportedLocales.includes(config.DEFAULT_LOCALE)) {
    throw new Error(
      'DEFAULT_LOCALE must be included in SUPPORTED_LOCALES',
    );
  }

  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    config.SWAGGER_ENABLED
  ) {
    throw new Error(
      'SWAGGER_ENABLED must be false in production unless explicitly reviewed',
    );
  }
}

export function parseCsv(value: string): string[] {
  return [...new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}
```

### 6.2. Vì sao không dùng `Boolean(value)`?

```ts
Boolean('false'); // true
```

Parser phải kiểm tra chính xác chuỗi `true` hoặc `false`.

### 6.3. Lưu ý với decorators default

Khi refactor thực tế, hãy thêm unit test để xác nhận `plainToInstance()` áp dụng default đúng với phiên bản `class-transformer` của dự án.

---

## 7. Tạo config namespaces

### 7.1. `app.config.ts`

```ts
// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

import { AppEnvironment } from '@/common/enums';

import type { AppConfig } from './config.types';
import { parseCsv } from './environment.validation';

export const APP_CONFIG_KEY = 'app';

export default registerAs(
  APP_CONFIG_KEY,
  (): AppConfig => ({
    environment:
      (process.env.NODE_ENV as AppEnvironment | undefined) ??
      AppEnvironment.DEVELOPMENT,
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    publicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
    trustProxy: process.env.TRUST_PROXY === 'true',
    requestTimeoutMs: Number(
      process.env.HTTP_REQUEST_TIMEOUT_MS ?? 15_000,
    ),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '2mb',
    urlEncodedBodyLimit:
      process.env.URL_ENCODED_BODY_LIMIT ?? '2mb',
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'vi-VN',
    supportedLocales: parseCsv(
      process.env.SUPPORTED_LOCALES ?? 'vi-VN,en-US',
    ),
  }),
);
```

`registerAs()` vẫn đọc `process.env` trong config factory. Đây là vị trí hợp lệ vì config layer là biên đọc environment.

### 7.2. `database.config.ts`

```ts
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

import type { DatabaseConfig } from './config.types';

export const DATABASE_CONFIG_KEY = 'database';

export default registerAs(
  DATABASE_CONFIG_KEY,
  (): DatabaseConfig => ({
    url: process.env.DATABASE_URL!,
  }),
);
```

Dấu `!` chỉ an toàn vì `validateEnvironment()` đã chạy trước khi config factory được sử dụng.

### 7.3. `cors.config.ts`

```ts
// src/config/cors.config.ts
import { registerAs } from '@nestjs/config';

import type { CorsConfig } from './config.types';
import { parseCsv } from './environment.validation';

export const CORS_CONFIG_KEY = 'cors';

export default registerAs(
  CORS_CONFIG_KEY,
  (): CorsConfig => ({
    allowedOrigins: parseCsv(
      process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:4200',
    ),
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    maxAgeSeconds: Number(process.env.CORS_MAX_AGE_SECONDS ?? 86_400),
  }),
);
```

### 7.4. `maintenance.config.ts`

```ts
// src/config/maintenance.config.ts
import { registerAs } from '@nestjs/config';

import type { MaintenanceConfig } from './config.types';

export const MAINTENANCE_CONFIG_KEY = 'maintenance';

export default registerAs(
  MAINTENANCE_CONFIG_KEY,
  (): MaintenanceConfig => ({
    enabled: process.env.MAINTENANCE_MODE === 'true',
    message:
      process.env.MAINTENANCE_MESSAGE ?? 'Hệ thống đang bảo trì',
    retryAfterSeconds: Number(
      process.env.MAINTENANCE_RETRY_AFTER_SECONDS ?? 300,
    ),
    bypassHeaderName:
      process.env.MAINTENANCE_BYPASS_HEADER ?? 'x-maintenance-key',
    bypassToken:
      process.env.MAINTENANCE_BYPASS_TOKEN?.trim() || undefined,
    allowedPaths: ['/api/v1/health'],
  }),
);
```

Allowed paths là application constant có thể giữ trong code. Chỉ chuyển sang env nếu deployment thực sự cần thay đổi nó.

---

## 8. Tạo `config.module.ts`

```ts
// src/config/config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import appConfig from './app.config';
import corsConfig from './cors.config';
import databaseConfig from './database.config';
import { validateEnvironment } from './environment.validation';
import maintenanceConfig from './maintenance.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      envFilePath: resolveEnvFilePaths(),
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      load: [
        appConfig,
        databaseConfig,
        corsConfig,
        maintenanceConfig,
      ],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}

function resolveEnvFilePaths(): string[] {
  const environment = process.env.NODE_ENV ?? 'development';

  return [
    `.env.${environment}.local`,
    `.env.${environment}`,
    '.env.local',
    '.env',
  ];
}
```

### Production

`ignoreEnvFile: true` trong production buộc deployment cấp biến qua runtime environment/secret manager.

Nếu nền tảng production của dự án bắt buộc dùng file mounted secret, điều chỉnh lại chính sách này có chủ đích.

---

## 9. Tạo `index.ts`

```ts
// src/config/index.ts
export * from './config.module';
export * from './config.types';
export * from './environment.validation';

export { APP_CONFIG_KEY } from './app.config';
export { CORS_CONFIG_KEY } from './cors.config';
export { DATABASE_CONFIG_KEY } from './database.config';
export { MAINTENANCE_CONFIG_KEY } from './maintenance.config';
```

Không cần export default config factories nếu bên ngoài không dùng trực tiếp.

---

## 10. Import config module trong `AppModule`

Sửa `src/app.module.ts`:

```ts
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfigModule } from '@/config';
import type {
  AppConfig,
  MaintenanceConfig,
} from '@/config';

@Module({
  imports: [
    AppConfigModule,
    CommonMiddlewaresModule.registerAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const app = configService.getOrThrow<AppConfig>('app');
        const maintenance =
          configService.getOrThrow<MaintenanceConfig>('maintenance');

        return {
          requestContext: {
            trustIncomingRequestId: true,
            trustIncomingCorrelationId: true,
          },
          locale: {
            defaultLocale: app.defaultLocale,
            supportedLocales: app.supportedLocales,
          },
          maintenance: {
            resolveState: () => ({
              enabled: maintenance.enabled,
              message: maintenance.message,
              retryAfterSeconds: maintenance.retryAfterSeconds,
            }),
            allowedPaths: maintenance.allowedPaths,
            bypassHeaderName: maintenance.bypassHeaderName,
            bypassToken: maintenance.bypassToken,
          },
        };
      },
    }),
    CommonInterceptorsModule,
    CommonFiltersModule,
  ],
})
export class AppModule implements NestModule {
  // middleware routing giữ nguyên
}
```

### Quan trọng

Mã nguồn hiện tại chỉ có `CommonMiddlewaresModule.register()`. Muốn dùng config qua DI đúng cách, module này cần hỗ trợ `registerAsync()`.

---

## 11. Bổ sung `registerAsync()` cho middleware module

### 11.1. Tạo async options interface

```ts
// src/common/middlewares/common-middlewares-async-options.interface.ts
import type {
  DynamicModule,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';

import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';

export interface CommonMiddlewaresOptionsFactory {
  createCommonMiddlewaresOptions():
    | CommonMiddlewaresOptions
    | Promise<CommonMiddlewaresOptions>;
}

export interface CommonMiddlewaresAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: readonly unknown[];
  useFactory?: (
    ...args: never[]
  ) => CommonMiddlewaresOptions | Promise<CommonMiddlewaresOptions>;
  useClass?: Type<CommonMiddlewaresOptionsFactory>;
  useExisting?: Type<CommonMiddlewaresOptionsFactory>;
  extraProviders?: Provider[];
}
```

Có thể đơn giản hóa interface theo convention đang dùng trong dự án.

### 11.2. Cập nhật module

```ts
// src/common/middlewares/common-middlewares.module.ts
import { DynamicModule, Module, Provider } from '@nestjs/common';

import { COMMON_MIDDLEWARE_OPTIONS } from './common-middlewares.constants';
import type { CommonMiddlewaresAsyncOptions } from './common-middlewares-async-options.interface';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';

@Module({})
export class CommonMiddlewaresModule {
  static register(
    options: CommonMiddlewaresOptions = {},
  ): DynamicModule {
    return {
      module: CommonMiddlewaresModule,
      providers: [
        {
          provide: COMMON_MIDDLEWARE_OPTIONS,
          useValue: options,
        },
      ],
      exports: [COMMON_MIDDLEWARE_OPTIONS],
    };
  }

  static registerAsync(
    options: CommonMiddlewaresAsyncOptions,
  ): DynamicModule {
    const optionsProvider: Provider = {
      provide: COMMON_MIDDLEWARE_OPTIONS,
      inject: options.inject ?? [],
      useFactory: options.useFactory ?? (() => ({})),
    };

    return {
      module: CommonMiddlewaresModule,
      imports: options.imports ?? [],
      providers: [
        optionsProvider,
        ...(options.extraProviders ?? []),
      ],
      exports: [COMMON_MIDDLEWARE_OPTIONS],
    };
  }
}
```

Nếu cần hỗ trợ `useClass`/`useExisting`, triển khai đầy đủ factory providers thay vì chỉ `useFactory`.

---

## 12. Sửa bootstrap để dùng config

Sau khi folder `src/bootstrap` được triển khai, application bootstrap nên lấy config từ DI container.

```ts
// src/bootstrap/application.bootstrap.ts
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '@/app.module';
import type { AppConfig, CorsConfig } from '@/config';

const logger = new Logger('Bootstrap');

export async function bootstrapApplication(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    {
      bufferLogs: true,
      bodyParser: false,
    },
  );

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');
  const corsConfig = configService.getOrThrow<CorsConfig>('cors');

  configureApplication(app, appConfig);
  configureCors(app, corsConfig);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);

  await app.listen(appConfig.port, appConfig.host);

  logger.log(`Application started at ${await app.getUrl()}`);
  logger.log(`Environment: ${appConfig.environment}`);
}
```

Ví dụ configurator:

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';

import { API_PREFIX } from '@/common/constants';
import { AppValidationPipe } from '@/common/pipes';
import type { AppConfig } from '@/config';

export function configureApplication(
  app: NestExpressApplication,
  config: AppConfig,
): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new AppValidationPipe());

  app.use(json({ limit: config.jsonBodyLimit }));
  app.use(
    urlencoded({
      extended: true,
      limit: config.urlEncodedBodyLimit,
    }),
  );

  if (config.trustProxy) {
    app.set('trust proxy', true);
  }
}
```

CORS:

```ts
import type { INestApplication } from '@nestjs/common';

import type { CorsConfig } from '@/config';

export function configureCors(
  app: INestApplication,
  config: CorsConfig,
): void {
  app.enableCors({
    origin: [...config.allowedOrigins],
    credentials: config.credentials,
    maxAge: config.maxAgeSeconds,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'accept-language',
      'x-request-id',
      'x-correlation-id',
      'idempotency-key',
    ],
    exposedHeaders: [
      'x-request-id',
      'x-correlation-id',
      'content-language',
      'retry-after',
    ],
  });
}
```

---

## 13. Sửa `main.ts`

Sau khi có bootstrap:

```ts
import { runApplication } from './bootstrap';

void runApplication();
```

Không đọc `PORT` tại `main.ts` nữa.

---

## 14. Prisma config và scripts

`prisma.config.ts` chạy ngoài Nest DI container nên vẫn có thể dùng Prisma env helper:

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

Đây là ngoại lệ hợp lệ.

`prisma/seed.ts` cũng chạy độc lập. Có thể giữ check hiện tại:

```ts
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}
```

Sau khi triển khai shared script config, seed và scripts có thể cùng dùng một helper `loadScriptEnvironment()` để tránh duplicate validation.

---

## 15. Typed config injection — lựa chọn nâng cao

Dùng chuỗi `'app'` với `ConfigService` là đủ cho giai đoạn đầu. Khi muốn type safety mạnh hơn, inject namespace trực tiếp:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import appConfig from '@/config/app.config';

@Injectable()
export class ExampleService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}
}
```

Ưu điểm:

- không gõ key chuỗi;
- type được suy luận từ factory;
- unit test dễ cung cấp provider riêng.

Không inject config namespace vào domain entities/value objects.

---

## 16. Thêm auth config khi auth module bắt đầu

### 16.1. Biến môi trường

```dotenv
JWT_ISSUER=quan-ly-truyen
JWT_AUDIENCE=quan-ly-truyen-web
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_SECRET=
JWT_REFRESH_TTL_SECONDS=2592000
BCRYPT_ROUNDS=12
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
AUTH_MAX_ACTIVE_SESSIONS=10
```

### 16.2. Cross-field validation bắt buộc

- access secret và refresh secret khác nhau;
- secret production có độ dài tối thiểu phù hợp;
- bcrypt rounds nằm trong range được phê duyệt;
- production yêu cầu secure cookie;
- TTL là số nguyên dương;
- issuer/audience không rỗng.

### 16.3. Không validate quá sớm

Không bắt buộc JWT secrets trước khi auth module được triển khai. Có thể dùng một feature flag tạm thời:

```dotenv
AUTH_ENABLED=false
```

Sau khi auth trở thành phần bắt buộc của ứng dụng, bỏ flag và yêu cầu secrets ở mọi deployment tương ứng.

---

## 17. Unit test cho validation

Tạo:

```text
src/config/environment.validation.spec.ts
```

Ví dụ:

```ts
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validBase = {
    NODE_ENV: 'test',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test',
  };

  it('parses boolean and integer values', () => {
    const result = validateEnvironment({
      ...validBase,
      PORT: '3100',
      MAINTENANCE_MODE: 'false',
    });

    expect(result.PORT).toBe(3100);
    expect(result.MAINTENANCE_MODE).toBe(false);
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test' }),
    ).toThrow('DATABASE_URL');
  });

  it('rejects wildcard origin with credentials', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        CORS_ALLOWED_ORIGINS: '*',
        CORS_CREDENTIALS: 'true',
      }),
    ).toThrow('CORS_ALLOWED_ORIGINS');
  });

  it('rejects unsupported default locale', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        DEFAULT_LOCALE: 'ja-JP',
        SUPPORTED_LOCALES: 'vi-VN,en-US',
      }),
    ).toThrow('DEFAULT_LOCALE');
  });
});
```

Cần test thêm:

- port ngoài range;
- timeout âm;
- boolean không hợp lệ;
- URL sai;
- duplicate origins/locales được normalize;
- Swagger production policy;
- secret rules sau khi auth config được thêm.

---

## 18. Test config namespaces

Ví dụ `app.config.spec.ts`:

```ts
import appConfig from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds typed application config', () => {
    process.env.PORT = '4000';
    process.env.SUPPORTED_LOCALES = 'vi-VN,en-US';

    expect(appConfig()).toEqual(
      expect.objectContaining({
        port: 4000,
        supportedLocales: ['vi-VN', 'en-US'],
      }),
    );
  });
});
```

Tránh để test thay đổi `process.env` mà không restore.

---

## 19. Cấu hình `.env.test`

Ví dụ local test:

```dotenv
NODE_ENV=test
HOST=127.0.0.1
PORT=0
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test?schema=public
CORS_ALLOWED_ORIGINS=http://localhost
CORS_CREDENTIALS=false
MAINTENANCE_MODE=false
SWAGGER_ENABLED=false
```

`PORT=0` cho phép hệ điều hành chọn port ngẫu nhiên trong E2E test, nhưng validator ở ví dụ trên đang yêu cầu `PORT >= 1`. Có hai cách:

1. cho phép `0` trong môi trường test;
2. không gọi `listen()` trong phần lớn E2E test và dùng `app.init()`.

Cách thứ hai thường sạch hơn.

---

## 20. CI/CD validation

Trong CI, cấp tối thiểu:

```yaml
env:
  NODE_ENV: test
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test
  CORS_ALLOWED_ORIGINS: http://localhost
  CORS_CREDENTIALS: 'false'
  MAINTENANCE_MODE: 'false'
  SWAGGER_ENABLED: 'false'
```

Thêm bước kiểm tra:

```bash
npm ci
npm run lint
npm run test
npm run build
```

Có thể thêm script riêng:

```json
{
  "scripts": {
    "config:check": "tsx scripts/config/check-environment.ts"
  }
}
```

Không echo toàn bộ env trong CI logs.

---

## 21. Docker Compose local đề xuất

`backend/docker-compose.yml` hiện đang rỗng. Có thể dùng PostgreSQL local:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: quan_ly_truyen
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - quan_ly_truyen_postgres:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d quan_ly_truyen']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  quan_ly_truyen_postgres:
```

Local `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quan_ly_truyen?schema=public
```

Không dùng password này trong staging/production.

---

## 22. Migration checklist

### Commit 1 — Security and examples

- [ ] Rotate database credential cũ.
- [ ] Xóa hoặc thay `docs/.env.example`.
- [ ] Tạo `backend/.env.example` bằng placeholder.
- [ ] Kiểm tra `.gitignore`.

### Commit 2 — Core config

- [ ] Cài `@nestjs/config`.
- [ ] Tạo `config.types.ts`.
- [ ] Tạo `environment.validation.ts`.
- [ ] Tạo app/database/CORS/maintenance config.
- [ ] Tạo `AppConfigModule`.
- [ ] Viết unit tests.

### Commit 3 — App wiring

- [ ] Import `AppConfigModule`.
- [ ] Thêm `registerAsync()` cho middleware module.
- [ ] Xóa `process.env` khỏi `AppModule`.
- [ ] Refactor bootstrap dùng typed config.
- [ ] Xóa `process.env.PORT` khỏi `main.ts`.

### Commit 4 — Operational setup

- [ ] Hoàn thiện Docker Compose local.
- [ ] Thêm CI env.
- [ ] Thêm config check script.
- [ ] Cập nhật README và tài liệu triển khai.

### Commit 5+ — Feature config

- [ ] Auth config khi auth module có implementation.
- [ ] Mail config khi email service tồn tại.
- [ ] Storage config khi media adapter tồn tại.
- [ ] Redis/queue config khi provider tồn tại.

---

## 23. Kiểm tra sau triển khai

Chạy:

```bash
npm run lint
npm run test
npm run build
npm run start:dev
```

Các tình huống cần kiểm tra thủ công:

### Thiếu database URL

```bash
DATABASE_URL= npm run start:dev
```

Kỳ vọng: process dừng với lỗi config rõ ràng.

### Boolean sai

```bash
MAINTENANCE_MODE=yes npm run start:dev
```

Kỳ vọng: process dừng, không tự hiểu `yes` là true.

### Port sai

```bash
PORT=99999 npm run start:dev
```

Kỳ vọng: process dừng.

### CORS không hợp lệ

```bash
CORS_ALLOWED_ORIGINS='*' CORS_CREDENTIALS=true npm run start:dev
```

Kỳ vọng: process dừng.

### Maintenance mode

```bash
MAINTENANCE_MODE=true npm run start:dev
```

Kỳ vọng:

- health path vẫn truy cập được;
- API khác trả service unavailable;
- bypass chỉ hoạt động khi header/token đúng.

---

## 24. Definition of Done

- [ ] `backend/.env.example` đầy đủ và không có secret.
- [ ] Credential cũ đã được rotate.
- [ ] `AppConfigModule` là global config module duy nhất.
- [ ] Validation chạy trước khi ứng dụng tạo connection.
- [ ] `AppModule` không đọc `process.env`.
- [ ] `main.ts` không đọc `process.env`.
- [ ] Bootstrap dùng typed config.
- [ ] Middleware options được đăng ký async từ config.
- [ ] Prisma vẫn đọc `DATABASE_URL` chính xác.
- [ ] Unit test cho config pass.
- [ ] Build và E2E test pass.
- [ ] Production deployment dùng secret manager/runtime env.

---

## 25. Quy trình thêm biến môi trường mới

Ví dụ cần thêm `MAIL_ENABLED`:

1. xác định module sở hữu: mail infrastructure;
2. thêm vào `.env.example`;
3. thêm raw field và validation;
4. thêm vào `MailConfig`;
5. thêm `mail.config.ts`;
6. đăng ký factory trong `ConfigModule`;
7. inject typed config vào mail module;
8. thêm unit test;
9. cập nhật tài liệu;
10. khai báo giá trị trong CI/staging/production secret store.

Không thêm env variable trực tiếp tại nơi sử dụng rồi để config layer cập nhật sau.
