import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';

import { RequestContextStore } from '@/common/middlewares';

import { PrismaService } from '@/infrastructure/database';

import type { AuthAuditAction } from '../../domain/enums';

const MAX_AUDIT_STRING_LENGTH = 2_000;

const MAX_AUDIT_DEPTH = 6;

const SENSITIVE_KEY_PATTERN =
  /(?:password|token|secret|authorization|cookie|credential|private[_-]?key)/iu;

export type AuthAuditActorType = 'USER' | 'SYSTEM';

export interface WriteAuthAuditInput {
  actorId?: string;

  actorType?: AuthAuditActorType;

  actorSessionId?: string;

  action: AuthAuditAction | string;

  entityType: string;

  entityId?: string;

  oldValues?: Readonly<Record<string, unknown>>;

  newValues?: Readonly<Record<string, unknown>>;

  metadata?: Readonly<Record<string, unknown>>;

  ipAddress?: string;

  userAgent?: string;
}

@Injectable()
export class PrismaAuthAuditWriterAdapter {
  private readonly logger = new Logger(PrismaAuthAuditWriterAdapter.name);

  constructor(
    private readonly prisma: PrismaService,

    private readonly requestContext: RequestContextStore,
  ) {}

  /**
   * Dùng cho thao tác cần audit cùng transaction.
   *
   * Nếu audit insert thất bại, transaction chính
   * cũng phải rollback.
   */
  async write(
    tx: Prisma.TransactionClient,

    input: WriteAuthAuditInput,
  ): Promise<void> {
    await tx.auditLog.create({
      data: this.createData(input),
    });
  }

  /**
   * Chỉ dùng cho event không có business
   * transaction để gắn cùng.
   *
   * Không được dùng cho password/email/session
   * mutation quan trọng.
   */
  async writeBestEffort(input: WriteAuthAuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: this.createData(input),
      });
    } catch {
      /*
       * Không log input vì có thể chứa metadata
       * nhạy cảm do caller truyền sai.
       */
      this.logger.warn('Auth audit write failed');
    }
  }

  private createData(
    input: WriteAuthAuditInput,
  ): Prisma.AuditLogUncheckedCreateInput {
    const context = this.requestContext.get();

    const actorType = input.actorType ?? (input.actorId ? 'USER' : 'SYSTEM');

    const metadata = sanitizeJsonObject({
      actorType,

      ...(input.actorSessionId
        ? {
            actorSessionId: input.actorSessionId,
          }
        : {}),

      ...(context?.correlationId
        ? {
            correlationId: context.correlationId,
          }
        : {}),

      ...(input.metadata ?? {}),
    });

    return {
      actorId: input.actorId,

      action: truncate(
        input.action,

        120,
      ),

      entityType: truncate(
        input.entityType,

        100,
      ),

      entityId: input.entityId
        ? truncate(
            input.entityId,

            100,
          )
        : undefined,

      ...(input.oldValues
        ? {
            oldValues: sanitizeJsonObject(input.oldValues),
          }
        : {}),

      ...(input.newValues
        ? {
            newValues: sanitizeJsonObject(input.newValues),
          }
        : {}),

      metadata,

      ipAddress: truncateOptional(
        input.ipAddress ?? context?.ipAddress,

        45,
      ),

      userAgent: truncateOptional(
        input.userAgent ?? context?.userAgent,

        MAX_AUDIT_STRING_LENGTH,
      ),

      requestId: truncateOptional(
        context?.requestId,

        100,
      ),
    };
  }
}

function sanitizeJsonObject(
  value: Readonly<Record<string, unknown>>,
): Prisma.InputJsonObject {
  const output: Record<string, Prisma.InputJsonValue | null> = {};

  for (const [key, child] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : sanitizeJsonValue(
          child,

          0,
        );
  }

  return output;
}

function sanitizeJsonValue(
  value: unknown,

  depth: number,
): Prisma.InputJsonValue | null {
  if (depth >= MAX_AUDIT_DEPTH) {
    return '[MAX_DEPTH]';
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return truncate(
      value,

      MAX_AUDIT_STRING_LENGTH,
    );
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeJsonValue(
        item,

        depth + 1,
      ),
    );
  }

  if (typeof value === 'object') {
    const output: Record<string, Prisma.InputJsonValue | null> = {};

    for (const [key, child] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : sanitizeJsonValue(
            child,

            depth + 1,
          );
    }

    return output;
  }

  return typeof value === 'symbol' ? value.toString() : JSON.stringify(value);
}

function truncate(
  value: string,

  maxLength: number,
): string {
  return value.length <= maxLength
    ? value
    : value.slice(
        0,

        maxLength,
      );
}

function truncateOptional(
  value: string | undefined,

  maxLength: number,
): string | undefined {
  return value
    ? truncate(
        value,

        maxLength,
      )
    : undefined;
}
