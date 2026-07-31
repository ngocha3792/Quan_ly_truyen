# PHASE 5 — SMTP / NODEMAILER IMPLEMENTATION GUIDE

> Dự án: **Quan-ly-truyen**  
> Phạm vi: `backend/src/infrastructure/mail`, BullMQ worker, transactional outbox, SMTP/Nodemailer  
> Mục tiêu: gửi email xác thực tài khoản, đặt lại mật khẩu, đổi email, thông báo kiểm duyệt và thông báo truyện/chương mới một cách an toàn, có retry và không chặn HTTP request.

---

## 1. Mục tiêu kiến trúc

Phase 5 không nên gọi `transporter.sendMail()` trực tiếp trong controller hoặc use case nghiệp vụ.

Luồng mục tiêu:

```text
HTTP request
    │
    ├─ Database transaction
    │    ├─ cập nhật dữ liệu nghiệp vụ
    │    ├─ tạo UserToken nếu cần
    │    └─ ghi OutboxEvent aggregateType = "mail"
    │
    ▼
Outbox dispatcher
    │
    └─ publish SendMailJobV1 vào queue MAIL
    ▼
Mail worker
    │
    ├─ kiểm tra job
    ├─ render template
    ├─ gửi qua Nodemailer SMTP
    └─ ghi log/trạng thái kết quả
```

Lợi ích:

- Request đăng ký/đặt lại mật khẩu không phải chờ SMTP.
- Nếu SMTP lỗi tạm thời, BullMQ retry.
- Giao dịch database và yêu cầu gửi mail không bị mất giữa chừng.
- Worker có thể scale riêng với API.
- Module nghiệp vụ không phụ thuộc trực tiếp Nodemailer.

---

## 2. Hiện trạng dự án có thể tận dụng

Dự án đã có:

```text
src/infrastructure/queue/contracts/mail.contracts.ts
src/infrastructure/queue/queue.constants.ts
src/infrastructure/queue/queue.module.ts
src/infrastructure/queue/outbox/
src/worker.module.ts
src/worker.ts
prisma/schema.prisma
```

Các thành phần liên quan đã tồn tại:

```ts
export const SEND_MAIL_JOB = 'mail.send.v1';

export interface SendMailJobV1 {
  version: 1;
  templateId: string;
  recipientEmail: string;
  variables: Record<string, unknown>;
  correlationId?: string;
}
```

Schema cũng đã có:

- `User.email`
- `User.emailVerifiedAt`
- `UserToken`
- `TokenType.EMAIL_VERIFICATION`
- `TokenType.PASSWORD_RESET`
- `TokenType.CHANGE_EMAIL`
- `NotificationPreference.emailEnabled`
- `OutboxEvent`
- `QUEUE_NAMES.MAIL`
- worker process riêng

Vì vậy không cần tạo một hệ thống mail độc lập thứ hai.

---

## 3. Lỗi routing outbox phải sửa trước

Hiện `OutboxDispatcherService.resolveTargetQueue()` map mọi aggregate type về `outboxQueue`.

Ví dụ hiện trạng:

```ts
const queueMap: Record<string, Queue> = {
  media: this.outboxQueue,
  mail: this.outboxQueue,
  notification: this.outboxQueue,
  story: this.outboxQueue,
  analytics: this.outboxQueue,
};
```

Điều này khiến event mail tiếp tục được đưa vào queue `OUTBOX`, thay vì queue `MAIL`.

### Kiến trúc đúng

Inject từng queue đích:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly configService: ConfigService,

  @InjectQueue(QUEUE_NAMES.OUTBOX)
  private readonly outboxQueue: Queue,

  @InjectQueue(QUEUE_NAMES.MAIL)
  private readonly mailQueue: Queue,

  @InjectQueue(QUEUE_NAMES.MEDIA)
  private readonly mediaQueue: Queue,

  @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
  private readonly notificationQueue: Queue,

  @InjectQueue(QUEUE_NAMES.ANALYTICS)
  private readonly analyticsQueue: Queue,
) {}
```

Routing:

```ts
private resolveTargetQueue(aggregateType: string): Queue | null {
  const queueMap: Record<string, Queue> = {
    mail: this.mailQueue,
    media: this.mediaQueue,
    notification: this.notificationQueue,
    analytics: this.analyticsQueue,
  };

  return queueMap[aggregateType.toLowerCase()] ?? null;
}
```

Khi publish job, dùng `outboxEventId` làm custom job ID để giảm duplicate:

```ts
await targetQueue.add(
  event.eventType,
  {
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
    outboxEventId: event.id,
    createdAt: event.createdAt.toISOString(),
  },
  {
    jobId: `outbox-${event.id}`,
  },
);
```

Không dùng dấu `:` trong custom job ID.

> `OutboxEvent.status = PUBLISHED` chỉ có nghĩa là đã publish thành công vào queue, không có nghĩa email đã được SMTP chấp nhận.

---

## 4. Cấu trúc folder đề xuất

```text
backend/src/infrastructure/mail/
├── application/
│   ├── mail-dispatch.service.ts
│   └── mail-health.service.ts
│
├── contracts/
│   ├── mail-sender.port.ts
│   ├── mail-message.interface.ts
│   ├── mail-send-result.interface.ts
│   └── mail-template.interface.ts
│
├── smtp/
│   ├── nodemailer.constants.ts
│   ├── nodemailer.provider.ts
│   ├── nodemailer-mail.adapter.ts
│   ├── nodemailer-error.mapper.ts
│   └── smtp-lifecycle.service.ts
│
├── templates/
│   ├── mail-template-id.enum.ts
│   ├── mail-template-registry.ts
│   ├── template-renderer.service.ts
│   ├── shared/
│   │   ├── email-layout.ts
│   │   ├── escape-html.ts
│   │   └── email-styles.ts
│   ├── email-verification.template.ts
│   ├── password-reset.template.ts
│   ├── change-email.template.ts
│   ├── moderation-result.template.ts
│   └── new-chapter.template.ts
│
├── queue/
│   ├── mail.processor.ts
│   ├── mail-job.mapper.ts
│   └── mail-job.validator.ts
│
├── exceptions/
│   ├── mail-configuration.exception.ts
│   ├── mail-delivery.exception.ts
│   ├── mail-template-not-found.exception.ts
│   └── invalid-mail-job.exception.ts
│
├── mail.module.ts
└── index.ts
```

### Quy tắc dependency

```text
Modules nghiệp vụ
    ↓
OutboxEvent / SendMailJobV1
    ↓
MailProcessor
    ↓
MailDispatchService
    ↓
MAIL_SENDER port
    ↓
NodemailerMailAdapter
    ↓
SMTP provider
```

Các module `auth`, `users`, `stories`, `moderation` không import `nodemailer`.

---

## 5. Cài dependencies

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

Không bắt buộc dùng `@nestjs-modules/mailer`. Dự án đã có cấu trúc infrastructure/port/adapter riêng, nên dùng Nodemailer trực tiếp sẽ ít abstraction dư hơn.

---

## 6. Biến môi trường

Bổ sung vào `.env.example`:

```env
# ============================================================
# MAIL / SMTP
# ============================================================
MAIL_ENABLED=false

MAIL_FROM_NAME=Quan Ly Truyen
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_REPLY_TO=support@example.com

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false

SMTP_USERNAME=
SMTP_PASSWORD=

SMTP_POOL_ENABLED=true
SMTP_MAX_CONNECTIONS=3
SMTP_MAX_MESSAGES=100
SMTP_RATE_LIMIT_PER_SECOND=5

SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=30000

SMTP_VERIFY_ON_STARTUP=true

# URL frontend dùng trong email
FRONTEND_PUBLIC_URL=http://localhost:4200

# Optional DKIM — chỉ bật khi tự ký DKIM tại ứng dụng
MAIL_DKIM_ENABLED=false
MAIL_DKIM_DOMAIN=
MAIL_DKIM_SELECTOR=
MAIL_DKIM_PRIVATE_KEY_BASE64=
```

### Local với Mailpit

```env
MAIL_ENABLED=true
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_VERIFY_ON_STARTUP=true
```

### Production port

Thông thường:

```text
Port 465  → SMTP_SECURE=true
Port 587  → SMTP_SECURE=false, STARTTLS
```

Không đặt `tls.rejectUnauthorized=false` trên production.

---

## 7. Bổ sung `MailConfig`

### `src/config/config.types.ts`

```ts
export interface MailConfig {
  enabled: boolean;

  fromName: string;
  fromAddress: string;
  replyTo?: string;

  frontendPublicUrl: string;

  smtp: {
    host: string;
    port: number;
    secure: boolean;
    requireTls: boolean;

    username?: string;
    password?: string;

    poolEnabled: boolean;
    maxConnections: number;
    maxMessages: number;
    rateLimitPerSecond: number;

    connectionTimeoutMs: number;
    greetingTimeoutMs: number;
    socketTimeoutMs: number;

    verifyOnStartup: boolean;
  };

  dkim: {
    enabled: boolean;
    domain?: string;
    selector?: string;
    privateKey?: string;
  };
}
```

### `src/config/mail.config.ts`

```ts
import { registerAs } from '@nestjs/config';

import type { MailConfig } from './config.types';

export const MAIL_CONFIG_KEY = 'mail';

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function decodeBase64(value: string | undefined): string | undefined {
  const encoded = optional(value);

  if (!encoded) {
    return undefined;
  }

  return Buffer.from(encoded, 'base64').toString('utf8');
}

export default registerAs(
  MAIL_CONFIG_KEY,
  (): MailConfig => ({
    enabled: process.env.MAIL_ENABLED === 'true',

    fromName: process.env.MAIL_FROM_NAME ?? 'Quan Ly Truyen',
    fromAddress:
      process.env.MAIL_FROM_ADDRESS ?? 'no-reply@example.com',
    replyTo: optional(process.env.MAIL_REPLY_TO),

    frontendPublicUrl:
      process.env.FRONTEND_PUBLIC_URL ?? 'http://localhost:4200',

    smtp: {
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      requireTls: process.env.SMTP_REQUIRE_TLS === 'true',

      username: optional(process.env.SMTP_USERNAME),
      password: optional(process.env.SMTP_PASSWORD),

      poolEnabled: process.env.SMTP_POOL_ENABLED !== 'false',
      maxConnections: Number(
        process.env.SMTP_MAX_CONNECTIONS ?? 3,
      ),
      maxMessages: Number(process.env.SMTP_MAX_MESSAGES ?? 100),
      rateLimitPerSecond: Number(
        process.env.SMTP_RATE_LIMIT_PER_SECOND ?? 5,
      ),

      connectionTimeoutMs: Number(
        process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 10_000,
      ),
      greetingTimeoutMs: Number(
        process.env.SMTP_GREETING_TIMEOUT_MS ?? 10_000,
      ),
      socketTimeoutMs: Number(
        process.env.SMTP_SOCKET_TIMEOUT_MS ?? 30_000,
      ),

      verifyOnStartup:
        process.env.SMTP_VERIFY_ON_STARTUP !== 'false',
    },

    dkim: {
      enabled: process.env.MAIL_DKIM_ENABLED === 'true',
      domain: optional(process.env.MAIL_DKIM_DOMAIN),
      selector: optional(process.env.MAIL_DKIM_SELECTOR),
      privateKey: decodeBase64(
        process.env.MAIL_DKIM_PRIVATE_KEY_BASE64,
      ),
    },
  }),
);
```

Đăng ký vào `AppConfigModule`:

```ts
load: [
  appConfig,
  databaseConfig,
  corsConfig,
  maintenanceConfig,
  redisConfig,
  queueConfig,
  mailConfig,
],
```

Export:

```ts
export { MAIL_CONFIG_KEY } from './mail.config';
```

---

## 8. Environment validation

Bổ sung các field tương ứng vào `EnvironmentVariables`.

Các cross-field rules cần có:

```ts
function validateMailRules(config: EnvironmentVariables): void {
  if (!config.MAIL_ENABLED) {
    return;
  }

  if (!config.SMTP_HOST.trim()) {
    throw new Error(
      'SMTP_HOST is required when MAIL_ENABLED=true',
    );
  }

  if (
    Boolean(config.SMTP_USERNAME) !==
    Boolean(config.SMTP_PASSWORD)
  ) {
    throw new Error(
      'SMTP_USERNAME and SMTP_PASSWORD must be provided together',
    );
  }

  if (config.SMTP_PORT === 465 && !config.SMTP_SECURE) {
    throw new Error(
      'SMTP_SECURE should be true when SMTP_PORT=465',
    );
  }

  if (config.MAIL_DKIM_ENABLED) {
    if (
      !config.MAIL_DKIM_DOMAIN ||
      !config.MAIL_DKIM_SELECTOR ||
      !config.MAIL_DKIM_PRIVATE_KEY_BASE64
    ) {
      throw new Error(
        'DKIM domain, selector and private key are required when MAIL_DKIM_ENABLED=true',
      );
    }
  }
}
```

Gọi trong `validateCrossFieldRules()`.

Không log:

```text
SMTP_PASSWORD
MAIL_DKIM_PRIVATE_KEY_BASE64
SMTP URL chứa credential
```

---

## 9. Mail sender port

### `contracts/mail-message.interface.ts`

```ts
export interface MailAddress {
  name?: string;
  address: string;
}

export interface MailMessage {
  to: MailAddress;
  subject: string;
  text: string;
  html: string;

  replyTo?: MailAddress;

  headers?: Record<string, string>;

  tags?: readonly string[];

  correlationId?: string;
  idempotencyKey?: string;
}
```

### `contracts/mail-send-result.interface.ts`

```ts
export interface MailSendResult {
  messageId: string;
  accepted: readonly string[];
  rejected: readonly string[];
  response?: string;
}
```

### `contracts/mail-sender.port.ts`

```ts
import type {
  MailMessage,
  MailSendResult,
} from './';

export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailSenderPort {
  verify(): Promise<void>;
  send(message: MailMessage): Promise<MailSendResult>;
  close(): void;
}
```

---

## 10. Nodemailer provider

### `smtp/nodemailer.constants.ts`

```ts
export const NODEMAILER_TRANSPORTER = Symbol(
  'NODEMAILER_TRANSPORTER',
);
```

### `smtp/nodemailer.provider.ts`

```ts
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, {
  type Transporter,
} from 'nodemailer';

import type { MailConfig } from '@/config';

import { NODEMAILER_TRANSPORTER } from './nodemailer.constants';

export const nodemailerProvider: Provider = {
  provide: NODEMAILER_TRANSPORTER,
  inject: [ConfigService],

  useFactory: (
    configService: ConfigService,
  ): Transporter => {
    const config =
      configService.getOrThrow<MailConfig>('mail');

    const auth =
      config.smtp.username && config.smtp.password
        ? {
            user: config.smtp.username,
            pass: config.smtp.password,
          }
        : undefined;

    const dkim = config.dkim.enabled
      ? {
          domainName: config.dkim.domain!,
          keySelector: config.dkim.selector!,
          privateKey: config.dkim.privateKey!,
          hashAlgo: 'sha256' as const,
        }
      : undefined;

    return nodemailer.createTransport(
      {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        requireTLS: config.smtp.requireTls,

        auth,

        pool: config.smtp.poolEnabled,
        maxConnections: config.smtp.maxConnections,
        maxMessages: config.smtp.maxMessages,

        rateDelta: 1000,
        rateLimit: config.smtp.rateLimitPerSecond,

        connectionTimeout:
          config.smtp.connectionTimeoutMs,
        greetingTimeout: config.smtp.greetingTimeoutMs,
        socketTimeout: config.smtp.socketTimeoutMs,

        disableFileAccess: true,
        disableUrlAccess: true,

        dkim,
      },
      {
        from: {
          name: config.fromName,
          address: config.fromAddress,
        },
        replyTo: config.replyTo,
      },
    );
  },
};
```

### Tại sao dùng một transporter singleton?

- Pool SMTP chỉ có ý nghĩa khi transporter được tái sử dụng.
- Không tạo transporter mới cho từng job.
- Worker process giữ một transporter dùng chung.
- Đóng transporter khi worker shutdown.

---

## 11. Nodemailer adapter

```ts
import {
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Transporter } from 'nodemailer';

import type {
  MailMessage,
  MailSenderPort,
  MailSendResult,
} from '../contracts';
import { MAIL_SENDER } from '../contracts';
import { MailDeliveryException } from '../exceptions';

import { NODEMAILER_TRANSPORTER } from './nodemailer.constants';

@Injectable()
export class NodemailerMailAdapter
  implements MailSenderPort
{
  constructor(
    @Inject(NODEMAILER_TRANSPORTER)
    private readonly transporter: Transporter,
  ) {}

  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(
    message: MailMessage,
  ): Promise<MailSendResult> {
    try {
      const result = await this.transporter.sendMail({
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        headers: {
          ...message.headers,
          ...(message.correlationId
            ? {
                'X-Correlation-Id':
                  message.correlationId,
              }
            : {}),
        },
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted.map(String),
        rejected: result.rejected.map(String),
        response: result.response,
      };
    } catch (error: unknown) {
      throw new MailDeliveryException({
        cause: error,
        details: {
          recipientDomain:
            message.to.address.split('@')[1],
          templateTags: message.tags,
          correlationId: message.correlationId,
        },
      });
    }
  }

  close(): void {
    this.transporter.close();
  }
}
```

Không log toàn bộ địa chỉ email nếu log có thể được truy cập rộng. Có thể mask:

```text
an***@example.com
```

Không log token xác thực hoặc reset password có trong link.

---

## 12. Lifecycle và SMTP verify

```ts
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MailConfig } from '@/config';

import {
  MAIL_SENDER,
  type MailSenderPort,
} from '../contracts';

@Injectable()
export class SmtpLifecycleService
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger = new Logger(
    SmtpLifecycleService.name,
  );

  constructor(
    @Inject(MAIL_SENDER)
    private readonly mailSender: MailSenderPort,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const config =
      this.configService.getOrThrow<MailConfig>('mail');

    if (!config.enabled) {
      this.logger.log('Mail delivery disabled');
      return;
    }

    if (!config.smtp.verifyOnStartup) {
      return;
    }

    await this.mailSender.verify();
    this.logger.log('SMTP connection verified');
  }

  onApplicationShutdown(): void {
    this.mailSender.close();
  }
}
```

### Fail-fast hay degraded mode?

Đề xuất:

- Worker mail: verify thất bại thì startup fail.
- API process: không khởi tạo SMTP transporter.
- `/health/ready` của API không phụ thuộc SMTP.
- Có health endpoint riêng cho worker/mail.

API đọc truyện không nên bị unavailable chỉ vì SMTP đang lỗi.

---

## 13. Template IDs

```ts
export enum MailTemplateId {
  EMAIL_VERIFICATION = 'email-verification.v1',
  PASSWORD_RESET = 'password-reset.v1',
  CHANGE_EMAIL = 'change-email.v1',
  WELCOME = 'welcome.v1',
  MODERATION_APPROVED = 'moderation-approved.v1',
  MODERATION_REJECTED = 'moderation-rejected.v1',
  NEW_CHAPTER = 'new-chapter.v1',
}
```

Không nhận tên file template tùy ý từ client.

Không dùng:

```ts
readFile(`templates/${templateId}.html`)
```

với `templateId` chưa được allowlist.

---

## 14. Template contract và renderer

```ts
export interface RenderedMailTemplate {
  subject: string;
  text: string;
  html: string;
  tags: readonly string[];
}

export interface MailTemplate<TVariables> {
  id: MailTemplateId;
  render(
    variables: TVariables,
  ): RenderedMailTemplate;
}
```

### Escape HTML

Mọi dữ liệu người dùng như `displayName`, `storyTitle`, `reason` phải escape trước khi chèn vào HTML.

```ts
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
```

### Layout chung

```ts
export function emailLayout(input: {
  previewText: string;
  title: string;
  bodyHtml: string;
  actionLabel?: string;
  actionUrl?: string;
}): string {
  const action = input.actionLabel && input.actionUrl
    ? `
      <p style="margin:24px 0">
        <a
          href="${escapeHtml(input.actionUrl)}"
          style="
            display:inline-block;
            padding:12px 18px;
            border-radius:8px;
            background:#111827;
            color:#ffffff;
            text-decoration:none;
          "
        >
          ${escapeHtml(input.actionLabel)}
        </a>
      </p>
    `
    : '';

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">
    ${escapeHtml(input.previewText)}
  </div>
  <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table
          width="100%"
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          style="
            max-width:600px;
            background:#ffffff;
            border-radius:12px;
          "
        >
          <tr>
            <td style="padding:32px">
              <h1 style="margin:0 0 20px;font-size:24px">
                ${escapeHtml(input.title)}
              </h1>
              ${input.bodyHtml}
              ${action}
              <p style="margin:32px 0 0;color:#6b7280;font-size:13px">
                Email tự động từ Quan Ly Truyen.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

Luôn cung cấp cả `text` và `html`.

---

## 15. Template xác thực email

```ts
interface EmailVerificationVariables {
  displayName: string;
  verificationUrl: string;
  expiresInMinutes: number;
}

export const emailVerificationTemplate:
  MailTemplate<EmailVerificationVariables> = {
  id: MailTemplateId.EMAIL_VERIFICATION,

  render(variables) {
    const displayName = escapeHtml(
      variables.displayName,
    );

    return {
      subject: 'Xác thực địa chỉ email của bạn',

      text: [
        `Xin chào ${variables.displayName},`,
        '',
        'Mở liên kết sau để xác thực email:',
        variables.verificationUrl,
        '',
        `Liên kết hết hạn sau ${variables.expiresInMinutes} phút.`,
        'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.',
      ].join('\n'),

      html: emailLayout({
        previewText:
          'Xác thực email để hoàn tất tài khoản.',
        title: 'Xác thực email',
        bodyHtml: `
          <p>Xin chào <strong>${displayName}</strong>,</p>
          <p>
            Hãy xác thực địa chỉ email để hoàn tất
            tài khoản của bạn.
          </p>
          <p>
            Liên kết hết hạn sau
            ${variables.expiresInMinutes} phút.
          </p>
          <p>
            Nếu bạn không thực hiện yêu cầu này,
            hãy bỏ qua email.
          </p>
        `,
        actionLabel: 'Xác thực email',
        actionUrl: variables.verificationUrl,
      }),

      tags: ['auth', 'email-verification'],
    };
  },
};
```

---

## 16. Template registry

```ts
import {
  Injectable,
} from '@nestjs/common';

@Injectable()
export class MailTemplateRegistry {
  private readonly templates = new Map<
    MailTemplateId,
    MailTemplate<Record<string, unknown>>
  >();

  constructor() {
    this.register(
      emailVerificationTemplate as MailTemplate<
        Record<string, unknown>
      >,
    );

    this.register(
      passwordResetTemplate as MailTemplate<
        Record<string, unknown>
      >,
    );
  }

  render(
    templateId: string,
    variables: Record<string, unknown>,
  ): RenderedMailTemplate {
    const template = this.templates.get(
      templateId as MailTemplateId,
    );

    if (!template) {
      throw new MailTemplateNotFoundException({
        templateId,
      });
    }

    return template.render(variables);
  }

  private register(
    template: MailTemplate<Record<string, unknown>>,
  ): void {
    this.templates.set(template.id, template);
  }
}
```

Tốt hơn nữa, mỗi template nên validate variables bằng DTO/class-validator hoặc một schema validator trước khi render.

---

## 17. Mail dispatch service

```ts
import {
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MailConfig } from '@/config';

import {
  MAIL_SENDER,
  type MailSenderPort,
} from '../contracts';
import { MailTemplateRegistry } from '../templates';

@Injectable()
export class MailDispatchService {
  constructor(
    @Inject(MAIL_SENDER)
    private readonly mailSender: MailSenderPort,
    private readonly templates: MailTemplateRegistry,
    private readonly configService: ConfigService,
  ) {}

  async dispatch(input: {
    templateId: string;
    recipientEmail: string;
    variables: Record<string, unknown>;
    correlationId?: string;
    outboxEventId?: string;
  }): Promise<void> {
    const config =
      this.configService.getOrThrow<MailConfig>('mail');

    if (!config.enabled) {
      throw new MailConfigurationException({
        message:
          'Mail job received while MAIL_ENABLED=false',
      });
    }

    const rendered = this.templates.render(
      input.templateId,
      input.variables,
    );

    const result = await this.mailSender.send({
      to: {
        address: input.recipientEmail,
      },
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tags: rendered.tags,
      correlationId: input.correlationId,
      idempotencyKey: input.outboxEventId,
      headers: input.outboxEventId
        ? {
            'X-Outbox-Event-Id':
              input.outboxEventId,
          }
        : undefined,
    });

    if (result.accepted.length === 0) {
      throw new MailDeliveryException({
        details: {
          rejectedCount: result.rejected.length,
          response: result.response,
        },
      });
    }
  }
}
```

---

## 18. Mail worker processor

Payload thực tế do outbox dispatcher tạo đang bọc `SendMailJobV1` trong `payload`.

Tạo contract envelope rõ ràng:

```ts
export interface OutboxQueueEnvelope<TPayload> {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: TPayload;
  outboxEventId: string;
  createdAt: string;
}
```

Processor:

```ts
import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  SEND_MAIL_JOB,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';
import { QUEUE_NAMES } from '@/infrastructure/queue';

import { MailDispatchService } from '../application';

@Processor(QUEUE_NAMES.MAIL)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(
    MailProcessor.name,
  );

  constructor(
    private readonly mailDispatchService:
      MailDispatchService,
  ) {
    super();
  }

  async process(
    job: Job<OutboxQueueEnvelope<SendMailJobV1>>,
  ): Promise<void> {
    if (job.name !== SEND_MAIL_JOB) {
      throw new InvalidMailJobException({
        jobName: job.name,
      });
    }

    const payload = job.data.payload;

    if (payload.version !== 1) {
      throw new InvalidMailJobException({
        version: payload.version,
      });
    }

    await this.mailDispatchService.dispatch({
      templateId: payload.templateId,
      recipientEmail: payload.recipientEmail,
      variables: payload.variables,
      correlationId:
        payload.correlationId,
      outboxEventId:
        job.data.outboxEventId,
    });

    this.logger.log(
      `Mail job ${job.id} accepted by SMTP`,
    );
  }
}
```

BullMQ phải throw `Error` để retry hoạt động đúng.

### Retry

Queue hiện đã có default:

```ts
attempts: queueConfig.defaultAttempts,
backoff: {
  type: 'exponential',
  delay: queueConfig.defaultBackoffMs,
},
```

Cho mail có thể override:

```ts
await mailQueue.add(name, data, {
  jobId: `outbox-${event.id}`,
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5000,
    jitter: 0.2,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 5000,
  },
  removeOnFail: {
    age: 14 * 24 * 60 * 60,
    count: 20_000,
  },
});
```

Không retry lỗi vĩnh viễn như:

- template không tồn tại
- variables sai schema
- recipient email sai format
- SMTP trả permanent 5xx rõ ràng
- mail bị policy từ chối vĩnh viễn

Có thể phân loại lỗi và dùng `UnrecoverableError` của BullMQ cho lỗi không retry.

---

## 19. Mail module

```ts
import { Module } from '@nestjs/common';

import { QueueModule } from '@/infrastructure/queue';

import { MailDispatchService } from './application';
import {
  MAIL_SENDER,
} from './contracts';
import { MailProcessor } from './queue';
import {
  nodemailerProvider,
  NodemailerMailAdapter,
  SmtpLifecycleService,
} from './smtp';
import {
  MailTemplateRegistry,
} from './templates';

@Module({
  imports: [
    QueueModule.register(),
  ],
  providers: [
    nodemailerProvider,

    {
      provide: MAIL_SENDER,
      useClass: NodemailerMailAdapter,
    },

    MailTemplateRegistry,
    MailDispatchService,
    MailProcessor,
    SmtpLifecycleService,
  ],
  exports: [
    MAIL_SENDER,
    MailDispatchService,
  ],
})
export class MailModule {}
```

### Tránh đăng ký QueueModule hai lần

Hiện `InfrastructureModule` đã import `QueueModule.register()`.

Cách sạch hơn:

- `MailModule` chỉ import `BullModule.registerQueue({ name: QUEUE_NAMES.MAIL })` nếu root Bull config đã global/phạm vi phù hợp.
- Hoặc export queue registration từ một module dùng chung.
- Không gọi `QueueModule.register()` lặp ở nhiều nơi nếu việc đó tạo nhiều provider/root configuration.

Khi triển khai thực tế, kiểm tra Nest module graph và chỉ cấu hình `BullModule.forRootAsync()` một lần.

---

## 20. WorkerModule

```ts
import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { InfrastructureModule } from './infrastructure';
import { MailModule } from './infrastructure/mail';
import { OutboxModule } from './infrastructure/queue/outbox';

@Module({
  imports: [
    AppConfigModule,
    InfrastructureModule,
    OutboxModule,
    MailModule,
  ],
})
export class WorkerModule {}
```

`MailProcessor` chỉ nên chạy trong worker process.

Không import `MailModule` chứa processor vào `AppModule`, nếu API và worker chạy riêng.

Có thể tách:

```text
MailProducerModule
MailWorkerModule
```

nếu cần tránh provider processor xuất hiện trong API process.

---

## 21. Ghi outbox trong Auth use case

Ví dụ đăng ký tài khoản:

```ts
await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: {
      email,
      username,
      passwordHash,
      displayName,
    },
  });

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  await tx.userToken.create({
    data: {
      userId: user.id,
      type: TokenType.EMAIL_VERIFICATION,
      tokenHash,
      expiresAt: addMinutes(new Date(), 30),
    },
  });

  const verificationUrl = new URL(
    '/verify-email',
    frontendPublicUrl,
  );

  verificationUrl.searchParams.set(
    'token',
    rawToken,
  );

  await tx.outboxEvent.create({
    data: {
      aggregateType: 'mail',
      aggregateId: user.id,
      eventType: SEND_MAIL_JOB,
      payload: {
        version: 1,
        templateId:
          MailTemplateId.EMAIL_VERIFICATION,
        recipientEmail: user.email,
        variables: {
          displayName: user.displayName,
          verificationUrl:
            verificationUrl.toString(),
          expiresInMinutes: 30,
        },
        correlationId,
      },
    },
  });

  return user;
});
```

### Lưu ý token

- Database chỉ lưu hash token.
- Raw token chỉ xuất hiện trong URL email.
- Không log raw token.
- Token chỉ dùng một lần.
- Khi xác thực, cập nhật `consumedAt` atomically.
- Xóa hoặc invalidate token cũ khi gửi lại.
- Có rate limit endpoint resend verification/reset password.

---

## 22. NotificationPreference

Không áp dụng `emailEnabled=false` cho email bảo mật bắt buộc:

```text
EMAIL_VERIFICATION
PASSWORD_RESET
CHANGE_EMAIL
SECURITY_ALERT
```

Có thể áp dụng preference cho:

```text
NEW_CHAPTER
COMMENT_REPLY
MARKETING
DIGEST
```

Tách khái niệm:

```text
Transactional/security mail → không phụ thuộc opt-in marketing
Notification mail           → kiểm tra NotificationPreference
Marketing mail              → cần consent/unsubscribe riêng
```

Không dùng một boolean `emailEnabled` để chặn cả password reset.

---

## 23. Có cần bảng `MailDelivery` không?

### MVP

Có thể chưa cần bảng riêng. Dùng:

- OutboxEvent để đảm bảo publish.
- BullMQ job history để quan sát delivery.
- structured logs theo `outboxEventId`, `jobId`, `messageId`.

### Production/audit cao

Nên thêm:

```prisma
enum MailDeliveryStatus {
  QUEUED
  SENDING
  ACCEPTED
  FAILED
  SUPPRESSED
}

model MailDelivery {
  id             String             @id @default(uuid()) @db.Uuid
  outboxEventId  String             @unique @map("outbox_event_id") @db.Uuid
  templateId     String             @map("template_id") @db.VarChar(100)
  recipientHash  String             @map("recipient_hash") @db.VarChar(128)
  status         MailDeliveryStatus @default(QUEUED)
  provider       String             @default("smtp") @db.VarChar(50)
  providerId     String?            @map("provider_id") @db.VarChar(255)
  attemptCount   Int                @default(0) @map("attempt_count")
  acceptedAt     DateTime?          @map("accepted_at") @db.Timestamptz(3)
  failedAt       DateTime?          @map("failed_at") @db.Timestamptz(3)
  lastErrorCode  String?            @map("last_error_code") @db.VarChar(100)
  lastError      String?            @map("last_error") @db.Text
  createdAt      DateTime           @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime           @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([status, createdAt])
  @@map("mail_deliveries")
}
```

Không lưu raw HTML chứa token nhạy cảm lâu dài.

---

## 24. Local SMTP bằng Mailpit

Bổ sung vào `docker-compose.yml`:

```yaml
services:
  postgres:
    # cấu hình hiện có

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit:v1.27
    restart: unless-stopped
    ports:
      - '1025:1025'
      - '8025:8025'
    environment:
      MP_MAX_MESSAGES: 5000
```

Sau khi chạy:

```bash
docker compose up -d
```

Mail UI:

```text
http://localhost:8025
```

SMTP:

```text
localhost:1025
```

Không dùng Mailpit trên production để gửi mail thật.

---

## 25. SPF, DKIM và DMARC

Nodemailer gửi được email không đồng nghĩa email vào inbox.

Production cần cấu hình DNS:

```text
SPF   → cho phép SMTP provider gửi thay domain
DKIM  → ký email bằng provider hoặc Nodemailer
DMARC → quy định cách xử lý SPF/DKIM fail và báo cáo
```

Ưu tiên dùng DKIM do SMTP provider quản lý nếu provider hỗ trợ.

Chỉ tự cấu hình DKIM trong Nodemailer khi:

- SMTP relay không tự ký.
- Bạn kiểm soát private key.
- DNS selector đã được publish.
- Có quy trình rotate key.

`MAIL_FROM_ADDRESS` nên thuộc domain đã được xác minh.

Không dùng địa chỉ From tùy ý do user nhập.

---

## 26. Error classification

Tạo mapper dựa trên Nodemailer error:

```ts
interface NodemailerError extends Error {
  code?: string;
  responseCode?: number;
  command?: string;
  response?: string;
}
```

Phân loại gợi ý:

```text
Retry:
- ETIMEDOUT
- ECONNECTION
- ESOCKET
- DNS tạm thời
- SMTP 421
- SMTP 450, 451, 452

Không retry:
- EAUTH do credential sai
- ECONFIG
- SMTP 550 mailbox không tồn tại
- SMTP 553 sender/recipient invalid
- template/variables lỗi
```

Không đưa full SMTP response chứa thông tin nhạy cảm ra API response.

Log structured:

```json
{
  "event": "mail_delivery_failed",
  "jobId": "outbox-...",
  "outboxEventId": "...",
  "templateId": "password-reset.v1",
  "recipientDomain": "example.com",
  "smtpCode": "EAUTH",
  "smtpResponseCode": 535,
  "attempt": 3,
  "correlationId": "..."
}
```

---

## 27. Security checklist

- [ ] Không gửi mail trực tiếp trong controller.
- [ ] Không expose SMTP password.
- [ ] Không log raw verification/reset token.
- [ ] Không cho client truyền subject/html.
- [ ] Chỉ cho phép `templateId` trong registry.
- [ ] Validate variables của từng template.
- [ ] Escape toàn bộ dữ liệu user-generated.
- [ ] Bật `disableFileAccess`.
- [ ] Bật `disableUrlAccess`.
- [ ] Không cho phép arbitrary attachments trong job.
- [ ] Rate limit resend verification/password reset.
- [ ] Hash token trước khi lưu database.
- [ ] Token có TTL và single-use.
- [ ] Không dùng `tls.rejectUnauthorized=false` production.
- [ ] From domain đã xác minh.
- [ ] SPF/DKIM/DMARC production.
- [ ] Mask email trong log.
- [ ] Worker shutdown đóng SMTP pool.
- [ ] Job có idempotency key.
- [ ] Retry chỉ cho lỗi transient.

---

## 28. Testing strategy

### Unit test template

```ts
describe('emailVerificationTemplate', () => {
  it('escapes user display name', () => {
    const result =
      emailVerificationTemplate.render({
        displayName: '<script>alert(1)</script>',
        verificationUrl:
          'https://frontend.test/verify?token=abc',
        expiresInMinutes: 30,
      });

    expect(result.html).not.toContain(
      '<script>alert(1)</script>',
    );

    expect(result.html).toContain(
      '&lt;script&gt;',
    );
  });

  it('provides both text and html', () => {
    const result =
      emailVerificationTemplate.render({
        displayName: 'Test User',
        verificationUrl:
          'https://frontend.test/verify?token=abc',
        expiresInMinutes: 30,
      });

    expect(result.text).toBeTruthy();
    expect(result.html).toBeTruthy();
  });
});
```

### Unit test adapter

Mock transporter:

```ts
const transporter = {
  verify: jest.fn(),
  sendMail: jest.fn(),
  close: jest.fn(),
};
```

Kiểm tra:

- mapping `to`, `subject`, `text`, `html`
- accepted/rejected
- mapper error
- transporter close

### Processor test

Kiểm tra:

- đúng `job.name`
- version sai bị reject
- gọi dispatch đúng một lần
- lỗi transient được throw để BullMQ retry
- lỗi permanent thành `UnrecoverableError`

### Integration test

Dùng Mailpit hoặc SMTP test server:

1. API ghi outbox.
2. Dispatcher publish queue MAIL.
3. Worker nhận job.
4. SMTP server nhận email.
5. Nội dung có đúng link/template.
6. Token trong link xác thực thành công.
7. Cùng outbox event không tạo duplicate job khi chưa bị auto-remove.

### Snapshot test MIME

Có thể dùng Nodemailer stream transport trong test để kiểm tra MIME output mà không dùng mạng.

---

## 29. Health và observability

### API readiness

Không gọi SMTP trong API readiness.

### Worker mail readiness

Có thể expose metric hoặc diagnostic:

```text
mail_smtp_verified = 1|0
mail_jobs_processed_total
mail_jobs_failed_total
mail_delivery_duration_ms
mail_delivery_retries_total
mail_delivery_rejected_total
```

`transporter.verify()` kiểm tra:

- DNS
- TCP connection
- TLS upgrade
- authentication

Nó không đảm bảo provider sẽ chấp nhận mọi địa chỉ From/recipient.

---

## 30. Thứ tự triển khai đề xuất

### Milestone 5.1 — SMTP foundation

1. Cài Nodemailer.
2. Thêm `MailConfig`.
3. Thêm environment validation.
4. Tạo provider và port/adapter.
5. Thêm Mailpit local.
6. Test `verify()` và gửi mail test.

### Milestone 5.2 — Templates

1. Tạo template registry.
2. Tạo layout chung.
3. Tạo email verification.
4. Tạo password reset.
5. Tạo change email.
6. Unit test escape HTML và links.

### Milestone 5.3 — Queue worker

1. Sửa outbox queue routing.
2. Tạo `MailProcessor`.
3. Import `MailModule` vào `WorkerModule`.
4. Dùng custom `jobId`.
5. Retry/backoff và error classification.
6. Test worker với Redis + Mailpit.

### Milestone 5.4 — Auth integration

1. Register user ghi `UserToken` + `OutboxEvent`.
2. Resend verification.
3. Forgot password.
4. Reset password.
5. Change email.
6. Rate limit và token single-use.

### Milestone 5.5 — Notification mail

1. Moderation approved/rejected.
2. New chapter notification.
3. Kiểm tra `NotificationPreference`.
4. Batch/fan-out strategy.
5. Metrics và operational dashboard.

---

## 31. Commit plan

```text
feat(config): add SMTP mail configuration

feat(mail): add mail sender contracts

feat(mail): add Nodemailer SMTP adapter

feat(dev): add Mailpit service

fix(outbox): route events to their target queues

feat(mail): add template registry and shared layout

feat(mail): add verification and reset templates

feat(mail): add BullMQ mail processor

feat(auth): enqueue email verification through outbox

feat(auth): enqueue password reset through outbox

feat(auth): add change-email mail workflow

feat(mail): add SMTP error classification and retry policy

test(mail): add template and adapter unit tests

test(mail): add Redis Mailpit integration flow

docs(mail): document SMTP operations and DNS setup
```

---

## 32. Definition of Done

Phase 5 hoàn thành khi:

- [ ] API không gửi SMTP trực tiếp.
- [ ] Mail event được ghi cùng database transaction.
- [ ] Outbox route chính xác sang queue `MAIL`.
- [ ] Worker riêng xử lý mail.
- [ ] Một Nodemailer transporter được reuse.
- [ ] SMTP config được validate khi startup.
- [ ] Mailpit hoạt động local.
- [ ] Có email verification.
- [ ] Có password reset.
- [ ] Có change-email flow.
- [ ] Mọi template có text và HTML.
- [ ] Variables được validate và escape.
- [ ] BullMQ retry transient failures.
- [ ] Permanent failures không retry vô hạn.
- [ ] Job có idempotency key.
- [ ] Không log token/SMTP secrets.
- [ ] Worker đóng connection pool khi shutdown.
- [ ] Production domain có SPF/DKIM/DMARC.
- [ ] Unit, integration và E2E tests pass.
- [ ] `npm run build`, `npm test`, `npm run lint` pass.

---

## 33. Tài liệu chính thức tham khảo

- Nodemailer SMTP transport: https://nodemailer.com/smtp
- Nodemailer pooled SMTP: https://nodemailer.com/smtp/pooled
- Nodemailer message configuration: https://nodemailer.com/message
- Nodemailer DKIM: https://nodemailer.com/dkim
- Nodemailer error reference: https://nodemailer.com/errors
- Nodemailer Ethereal testing: https://nodemailer.com/guides/testing-with-ethereal
- NestJS queues: https://docs.nestjs.com/techniques/queues
- BullMQ retry/backoff: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ idempotent jobs: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ custom job IDs: https://docs.bullmq.io/guide/jobs/job-ids
- Mailpit Docker: https://mailpit.axllent.org/docs/install/docker/
