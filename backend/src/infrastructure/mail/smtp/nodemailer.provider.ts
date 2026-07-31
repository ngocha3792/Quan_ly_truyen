import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import type { MailConfig } from '@/config';

import { NODEMAILER_TRANSPORTER } from './nodemailer.constants';

export const nodemailerProvider: Provider = {
  provide: NODEMAILER_TRANSPORTER,
  inject: [ConfigService],
  useFactory: (
    configService: ConfigService,
  ): Transporter<SMTPTransport.SentMessageInfo> => {
    const config = configService.getOrThrow<MailConfig>('mail');
    const auth =
      config.smtp.username && config.smtp.password
        ? { user: config.smtp.username, pass: config.smtp.password }
        : undefined;
    const dkim = config.dkim.enabled
      ? {
          domainName: config.dkim.domain!,
          keySelector: config.dkim.selector!,
          privateKey: config.dkim.privateKey!,
          hashAlgo: 'sha256' as const,
        }
      : undefined;

    const transportOptions = {
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
      connectionTimeout: config.smtp.connectionTimeoutMs,
      greetingTimeout: config.smtp.greetingTimeoutMs,
      socketTimeout: config.smtp.socketTimeoutMs,
      disableFileAccess: true,
      disableUrlAccess: true,
      dkim,
    } as SMTPTransport.Options;

    return nodemailer.createTransport(transportOptions, {
      from: { name: config.fromName, address: config.fromAddress },
      replyTo: config.replyTo,
    });
  },
};
