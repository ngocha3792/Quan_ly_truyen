import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database';

import {
  AiRateLimitPersistencePort,
  AiRateLimitReservationResult,
  ReserveAiRateLimitInput,
} from '../../application/ports/ai-rate-limit.persistence.port';

interface BucketRow {
  readonly request_count: number;
  readonly token_count: number;
}

@Injectable()
export class PrismaAiRateLimitPersistence implements AiRateLimitPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(
    input: ReserveAiRateLimitInput,
  ): Promise<AiRateLimitReservationResult> {
    const rows = await this.prisma.$queryRaw<BucketRow[]>`
      INSERT INTO "ai_rate_limit_buckets" (
        "user_id",
        "window_start",
        "request_count",
        "token_count",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${input.userId}::uuid,
        ${input.windowStart},
        1,
        ${input.tokens},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("user_id", "window_start") DO UPDATE
      SET
        "request_count" = "ai_rate_limit_buckets"."request_count" + 1,
        "token_count" = "ai_rate_limit_buckets"."token_count" + ${input.tokens},
        "updated_at" = CURRENT_TIMESTAMP
      WHERE
        "ai_rate_limit_buckets"."request_count" < ${input.requestLimit}
        AND "ai_rate_limit_buckets"."token_count" + ${input.tokens} <= ${input.tokenLimit}
      RETURNING "request_count", "token_count"
    `;

    if (rows[0]) {
      return { allowed: true, bucket: this.toBucket(rows[0]) };
    }

    const current = await this.prisma.aiRateLimitBucket.findUnique({
      where: {
        userId_windowStart: {
          userId: input.userId,
          windowStart: input.windowStart,
        },
      },
      select: { requestCount: true, tokenCount: true },
    });

    return {
      allowed: false,
      bucket: current ?? { requestCount: 0, tokenCount: 0 },
    };
  }

  async reconcileTokens(
    userId: string,
    windowStart: Date,
    reservedTokens: number,
    actualTokens: number,
  ): Promise<void> {
    const delta = actualTokens - reservedTokens;
    if (delta === 0) return;

    await this.prisma.$executeRaw`
      UPDATE "ai_rate_limit_buckets"
      SET
        "token_count" = GREATEST(0, "token_count" + ${delta}),
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "user_id" = ${userId}::uuid
        AND "window_start" = ${windowStart}
    `;
  }

  private toBucket(row: BucketRow) {
    return {
      requestCount: Number(row.request_count),
      tokenCount: Number(row.token_count),
    };
  }
}
