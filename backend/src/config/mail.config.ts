import { registerAs } from '@nestjs/config';

import type { MailConfig } from './config.types';

export const MAIL_CONFIG_KEY = 'mail';

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function decodeBase64(value: string | undefined): string | undefined {
  const encoded = optional(value);
  return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : undefined;
}

export default registerAs(MAIL_CONFIG_KEY, (): MailConfig => ({
  enabled: process.env.MAIL_ENABLED === 'true',
  fromName: process.env.MAIL_FROM_NAME ?? 'Quan Ly Truyen',
  fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@example.com',
  replyTo: optional(process.env.MAIL_REPLY_TO),
  frontendPublicUrl: process.env.FRONTEND_PUBLIC_URL ?? 'http://localhost:4200',
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    requireTls: process.env.SMTP_REQUIRE_TLS === 'true',
    username: optional(process.env.SMTP_USERNAME),
    password: optional(process.env.SMTP_PASSWORD),
    poolEnabled: process.env.SMTP_POOL_ENABLED !== 'false',
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS ?? 3),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES ?? 100),
    rateLimitPerSecond: Number(process.env.SMTP_RATE_LIMIT_PER_SECOND ?? 5),
    connectionTimeoutMs: Number(
      process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 10_000,
    ),
    greetingTimeoutMs: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 10_000),
    socketTimeoutMs: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 30_000),
    verifyOnStartup: process.env.SMTP_VERIFY_ON_STARTUP !== 'false',
  },
  dkim: {
    enabled: process.env.MAIL_DKIM_ENABLED === 'true',
    domain: optional(process.env.MAIL_DKIM_DOMAIN),
    selector: optional(process.env.MAIL_DKIM_SELECTOR),
    privateKey: decodeBase64(process.env.MAIL_DKIM_PRIVATE_KEY_BASE64),
  },
}));
