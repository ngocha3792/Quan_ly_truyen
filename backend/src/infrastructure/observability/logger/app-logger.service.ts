import { context, trace } from '@opentelemetry/api';
import {
  Inject,
  Injectable,
  LoggerService,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import pino, {
  type DestinationStream,
  type Level,
  type Logger as PinoLogger,
} from 'pino';

import { RequestContextStore } from '@/common/middlewares';
import type { ObservabilityConfig } from '@/config';

import { APP_LOG_DESTINATION } from './logging.constants';
import { sanitizeLogError, sanitizeLogValue } from './log-sanitizer';

type WritableLogLevel = Exclude<Level, 'silent'>;

@Injectable()
export class AppLoggerService implements LoggerService, OnApplicationShutdown {
  private readonly root: PinoLogger;

  constructor(
    configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(APP_LOG_DESTINATION)
    destination?: DestinationStream,
  ) {
    const config =
      configService.getOrThrow<ObservabilityConfig>('observability');
    const transport =
      config.log.pretty && process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
            },
          }
        : undefined;

    this.root = pino(
      {
        level: config.log.level,
        base: {
          'service.name': config.serviceName,
          'service.version': config.serviceVersion,
          'deployment.environment': process.env.NODE_ENV ?? 'development',
          'service.instance.id': config.serviceInstanceId,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        serializers: { err: (value: unknown) => value },
        ...(transport && !destination ? { transport } : {}),
        redact: {
          paths: [
            'password',
            '*.password',
            'token',
            '*.token',
            'authorization',
            '*.authorization',
            'cookie',
            '*.cookie',
            'rawBody',
            '*.rawBody',
            'emailBody',
            '*.emailBody',
          ],
          censor: '[REDACTED]',
        },
      },
      destination,
    );
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  onApplicationShutdown(): void {
    this.flush();
  }

  flush(): void {
    try {
      this.root.flush();
    } catch {
      // Logging must never make shutdown or a business request fail.
    }
  }

  private write(
    level: WritableLogLevel,
    message: unknown,
    optionalParams: readonly unknown[],
  ): void {
    try {
      const request = this.getRequestContext();
      const spanContext = trace.getSpan(context.active())?.spanContext();
      const nestContext = extractNestContext(optionalParams);
      const error = extractError(message, optionalParams);
      const sanitizedMessage = sanitizeLogValue(message);
      const fields =
        sanitizedMessage &&
        typeof sanitizedMessage === 'object' &&
        !Array.isArray(sanitizedMessage) &&
        !(message instanceof Error)
          ? (sanitizedMessage as Record<string, unknown>)
          : {};
      const text =
        typeof sanitizedMessage === 'string'
          ? sanitizedMessage
          : typeof fields.message === 'string'
            ? fields.message
            : undefined;

      this.root[level](
        {
          ...fields,
          ...(nestContext ? { context: nestContext } : {}),
          ...(request?.requestId ? { requestId: request.requestId } : {}),
          ...(request?.correlationId
            ? { correlationId: request.correlationId }
            : {}),
          ...(request?.userId ? { userId: request.userId } : {}),
          ...(spanContext?.traceId ? { traceId: spanContext.traceId } : {}),
          ...(spanContext?.spanId ? { spanId: spanContext.spanId } : {}),
          ...(error ? { err: sanitizeLogError(error) } : {}),
        },
        text,
      );
    } catch {
      // Do not surface serialization or stdout failures to application code.
    }
  }

  private getRequestContext() {
    try {
      return this.moduleRef.get(RequestContextStore, { strict: false }).get();
    } catch {
      return undefined;
    }
  }
}

function extractNestContext(params: readonly unknown[]): string | undefined {
  const last = params.at(-1);
  if (typeof last !== 'string' || looksLikeStack(last)) return undefined;
  return last.slice(0, 200);
}

function extractError(
  message: unknown,
  params: readonly unknown[],
): Error | undefined {
  if (message instanceof Error) return message;
  const error = params.find((param) => param instanceof Error);
  if (error instanceof Error) return error;
  const stack = params.find(
    (param): param is string =>
      typeof param === 'string' && looksLikeStack(param),
  );
  if (!stack) return undefined;
  const synthetic = new Error(
    typeof message === 'string' ? message : 'Application error',
  );
  synthetic.stack = stack;
  return synthetic;
}

function looksLikeStack(value: string): boolean {
  return value.includes('\n') || /^(?:Error|[A-Za-z]+Error):/.test(value);
}
