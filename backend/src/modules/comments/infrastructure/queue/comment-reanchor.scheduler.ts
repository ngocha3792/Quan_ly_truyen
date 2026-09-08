import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { CommentAnchorStatus, Prisma } from '@/generated/prisma/client';
import { readerFeaturesConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';
import { reanchorTextRange, type TextRangeAnchor } from '../../domain';

const SCHEDULER_TICK_MS = 5_000;

@Injectable()
export class CommentReanchorScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommentReanchorScheduler.name);
  private lastRunAt = 0;
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(readerFeaturesConfig.KEY)
    private readonly features: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  onModuleInit(): void {
    if (!this.features.inlineCommentsEnabled) return;
    this.timer = setInterval(() => void this.tick(), SCHEDULER_TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    const now = Date.now();
    if (
      !this.features.inlineCommentsEnabled ||
      this.running ||
      now - this.lastRunAt < this.features.inlineCommentsReanchorIntervalMs
    )
      return;
    this.running = true;
    this.lastRunAt = now;
    try {
      await this.processBatch();
    } catch (error: unknown) {
      this.logger.error(
        'Inline comment re-anchor batch failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  async processBatch(): Promise<number> {
    const candidates = await this.prisma.$queryRaw<
      Array<{ id: string }>
    >(Prisma.sql`
      SELECT anchor."id"
      FROM "comment_anchors" anchor
      JOIN "chapters" chapter ON chapter."id" = anchor."chapter_id"
      WHERE chapter."version" > anchor."last_verified_version"
      ORDER BY anchor."updated_at" ASC, anchor."id" ASC
      LIMIT ${this.features.inlineCommentsReanchorBatchSize}
    `);
    const rows = await this.prisma.commentAnchor.findMany({
      where: { id: { in: candidates.map(({ id }) => id) } },
      include: {
        chapter: { select: { version: true, contentDocument: true } },
      },
    });
    let processed = 0;
    for (const row of rows) {
      const original: TextRangeAnchor = {
        startBlockId: row.startBlockId,
        startOffset: row.startOffset,
        endBlockId: row.endBlockId,
        endOffset: row.endOffset,
        quoteText: row.quoteText,
        quoteHash: row.quoteHash,
        excerptBefore: row.excerptBefore,
        excerptAfter: row.excerptAfter,
      };
      const next = reanchorTextRange(
        original,
        parseBlocks(row.chapter.contentDocument),
      );
      const updated = await this.prisma.commentAnchor.updateMany({
        where: { id: row.id, lastVerifiedVersion: row.lastVerifiedVersion },
        data: next
          ? {
              status: CommentAnchorStatus.REANCHORED,
              startBlockId: next.startBlockId,
              startOffset: next.startOffset,
              endBlockId: next.endBlockId,
              endOffset: next.endOffset,
              quoteText: next.quoteText,
              quoteHash: next.quoteHash,
              excerptBefore: next.excerptBefore,
              excerptAfter: next.excerptAfter,
              lastVerifiedVersion: row.chapter.version,
              reanchoredFromVersion: row.lastVerifiedVersion,
              reanchoredAt: new Date(),
              orphanedAt: null,
              orphanedReason: null,
            }
          : {
              status: CommentAnchorStatus.ORPHANED,
              lastVerifiedVersion: row.chapter.version,
              orphanedAt: new Date(),
              orphanedReason: 'quote_not_found',
            },
      });
      processed += updated.count;
    }
    return processed;
  }
}

function parseBlocks(
  value: Prisma.JsonValue | null,
): readonly { id: string; text: string }[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const blocks = (value as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap((block) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return [];
    const candidate = block as { id?: unknown; text?: unknown };
    return typeof candidate.id === 'string' &&
      typeof candidate.text === 'string'
      ? [{ id: candidate.id, text: candidate.text }]
      : [];
  });
}
