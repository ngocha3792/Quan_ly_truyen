import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InboundWebhookStatus,
  MediaResourceType,
  MediaStatus,
  Prisma,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';

export interface WebhookProcessingSummary {
  scanned: number;
  processed: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class CloudinaryWebhookInboxProcessor {
  private readonly logger = new Logger(CloudinaryWebhookInboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async processBatch(batchSize = 100): Promise<WebhookProcessingSummary> {
    const take = Math.min(Math.max(batchSize, 1), 500);
    const maxAttempts = this.configService.get<number>(
      'cloudinary.webhookMaxAttempts',
      5,
    );
    const now = new Date();
    await this.recoverStaleClaims(now, maxAttempts);
    const events = await this.prisma.inboundWebhookEvent.findMany({
      where: {
        provider: 'cloudinary',
        status: {
          in: [InboundWebhookStatus.PENDING, InboundWebhookStatus.FAILED],
        },
        attempts: { lt: maxAttempts },
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take,
    });
    const summary = {
      scanned: events.length,
      processed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const event of events) {
      const claim = await this.prisma.inboundWebhookEvent.updateMany({
        where: {
          id: event.id,
          status: event.status,
          attempts: event.attempts,
        },
        data: {
          status: InboundWebhookStatus.PROCESSING,
          attempts: { increment: 1 },
          processingStartedAt: now,
        },
      });
      if (claim.count !== 1) {
        summary.skipped++;
        continue;
      }
      const claimedAttempt = event.attempts + 1;

      try {
        const disposition = await this.processEvent(
          event.eventType,
          event.payload,
        );
        const finalized = await this.prisma.inboundWebhookEvent.updateMany({
          where: {
            id: event.id,
            status: InboundWebhookStatus.PROCESSING,
            attempts: claimedAttempt,
          },
          data: {
            status:
              disposition === 'ignored'
                ? InboundWebhookStatus.IGNORED
                : InboundWebhookStatus.PROCESSED,
            processedAt: new Date(),
            processingStartedAt: null,
            lastError: null,
          },
        });
        if (finalized.count === 1) {
          summary.processed++;
        } else {
          summary.skipped++;
          this.logOwnershipLost(event.eventKey, claimedAttempt);
        }
      } catch (error: unknown) {
        const attempts = claimedAttempt;
        const deadLetter = attempts >= maxAttempts;
        const retryBaseMs = this.configService.get<number>(
          'cloudinary.webhookRetryBaseMs',
          5000,
        );
        const lastError =
          error instanceof Error
            ? error.message.slice(0, 1000)
            : 'Unknown webhook processing error';
        const finalized = await this.prisma.inboundWebhookEvent.updateMany({
          where: {
            id: event.id,
            status: InboundWebhookStatus.PROCESSING,
            attempts: claimedAttempt,
          },
          data: {
            status: deadLetter
              ? InboundWebhookStatus.DEAD_LETTER
              : InboundWebhookStatus.FAILED,
            lastError,
            processingStartedAt: null,
            nextAttemptAt: new Date(
              Date.now() + retryBaseMs * 2 ** Math.max(attempts - 1, 0),
            ),
          },
        });
        if (finalized.count !== 1) {
          summary.skipped++;
          this.logOwnershipLost(event.eventKey, claimedAttempt);
          continue;
        }

        summary.failed++;
        this.logger.warn({
          message: 'cloudinary webhook processing failed',
          eventKey: event.eventKey,
          retryable: !deadLetter,
        });
      }
    }
    return summary;
  }

  private logOwnershipLost(eventKey: string, claimedAttempt: number): void {
    this.logger.warn({
      message: 'cloudinary webhook ownership lost before finalization',
      eventKey,
      claimedAttempt,
    });
  }

  private async recoverStaleClaims(
    now: Date,
    maxAttempts: number,
  ): Promise<void> {
    const staleBefore = new Date(now.getTime() - 5 * 60_000);
    await this.prisma.inboundWebhookEvent.updateMany({
      where: {
        provider: 'cloudinary',
        status: InboundWebhookStatus.PROCESSING,
        processingStartedAt: { lt: staleBefore },
        attempts: { lt: maxAttempts },
      },
      data: {
        status: InboundWebhookStatus.FAILED,
        processingStartedAt: null,
        nextAttemptAt: now,
        lastError: 'Stale webhook claim recovered',
      },
    });
    await this.prisma.inboundWebhookEvent.updateMany({
      where: {
        provider: 'cloudinary',
        status: InboundWebhookStatus.PROCESSING,
        processingStartedAt: { lt: staleBefore },
        attempts: { gte: maxAttempts },
      },
      data: {
        status: InboundWebhookStatus.DEAD_LETTER,
        processingStartedAt: null,
        lastError: 'Webhook retry limit reached after stale claim',
      },
    });
  }

  private async processEvent(
    eventType: string | null,
    payload: Prisma.JsonValue,
  ): Promise<'processed' | 'ignored'> {
    const record = asRecord(payload);
    const publicId = readString(record.public_id);
    const resourceType = toPrismaResourceType(readString(record.resource_type));
    const providerAssetId = readString(record.asset_id);
    const version = readPositiveInteger(record.version);
    const normalizedType = eventType?.toLowerCase() ?? '';

    if (
      ['upload', 'resource_created', 'resource_uploaded'].includes(
        normalizedType,
      )
    ) {
      if (!publicId || !resourceType) return 'ignored';
      await this.prisma.mediaAsset.updateMany({
        where: {
          status: MediaStatus.PENDING,
          OR: [
            ...(providerAssetId ? [{ providerAssetId }] : []),
            { publicId, resourceType },
          ],
        },
        data: { status: MediaStatus.UPLOADED, uploadedAt: new Date() },
      });
      return 'processed';
    }
    if (['delete', 'resource_deleted'].includes(normalizedType)) {
      if (!publicId || !resourceType) return 'ignored';
      await this.prisma.mediaAsset.updateMany({
        where: {
          status: {
            in: [
              MediaStatus.PENDING,
              MediaStatus.UPLOADED,
              MediaStatus.PROCESSING,
              MediaStatus.FAILED,
              MediaStatus.READY,
              MediaStatus.DELETING,
              MediaStatus.DELETE_FAILED,
            ],
          },
          AND: [
            {
              OR: [
                ...(providerAssetId ? [{ providerAssetId }] : []),
                { publicId, resourceType },
              ],
            },
            ...(version
              ? [{ OR: [{ version: null }, { version: { lte: version } }] }]
              : []),
          ],
        },
        data: { status: MediaStatus.DELETED, deletedAt: new Date() },
      });
      return 'processed';
    }
    return 'ignored';
  }
}

function asRecord(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function readString(value: Prisma.JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readPositiveInteger(
  value: Prisma.JsonValue | undefined,
): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function toPrismaResourceType(
  value: string | undefined,
): MediaResourceType | undefined {
  const map: Record<string, MediaResourceType> = {
    image: MediaResourceType.IMAGE,
    video: MediaResourceType.VIDEO,
    raw: MediaResourceType.RAW,
  };
  return value ? map[value.toLowerCase()] : undefined;
}
