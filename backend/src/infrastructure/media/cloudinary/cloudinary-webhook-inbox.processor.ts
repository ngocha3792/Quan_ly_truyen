import { Injectable, Logger } from '@nestjs/common';
import { MediaStatus, Prisma } from '@/generated/prisma/client';
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

  constructor(private readonly prisma: PrismaService) {}

  async processBatch(batchSize = 100): Promise<WebhookProcessingSummary> {
    const take = Math.min(Math.max(batchSize, 1), 500);
    const events = await this.prisma.inboundWebhookEvent.findMany({
      where: { provider: 'cloudinary', status: 'pending' },
      orderBy: { receivedAt: 'asc' },
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
        where: { id: event.id, status: 'pending' },
        data: { status: 'processing', attempts: { increment: 1 } },
      });
      if (claim.count !== 1) {
        summary.skipped++;
        continue;
      }

      try {
        await this.processEvent(event.eventType, event.payload);
        await this.prisma.inboundWebhookEvent.updateMany({
          where: { id: event.id, status: 'processing' },
          data: {
            status: 'processed',
            processedAt: new Date(),
            lastError: null,
          },
        });
        summary.processed++;
      } catch (error: unknown) {
        const lastError =
          error instanceof Error
            ? error.message.slice(0, 1000)
            : 'Unknown webhook processing error';
        await this.prisma.inboundWebhookEvent.updateMany({
          where: { id: event.id, status: 'processing' },
          data: { status: 'pending', lastError },
        });
        summary.failed++;
        this.logger.warn({
          message: 'cloudinary webhook processing failed',
          eventKey: event.eventKey,
          retryable: true,
        });
      }
    }
    return summary;
  }

  private async processEvent(
    eventType: string | null,
    payload: Prisma.JsonValue,
  ): Promise<void> {
    const record = asRecord(payload);
    const publicId = readString(record.public_id);
    if (!publicId) return;
    const normalizedType = eventType?.toLowerCase() ?? '';

    if (normalizedType.includes('upload')) {
      await this.prisma.mediaAsset.updateMany({
        where: { publicId, status: MediaStatus.PENDING },
        data: { status: MediaStatus.UPLOADED, uploadedAt: new Date() },
      });
      return;
    }
    if (normalizedType.includes('delete')) {
      await this.prisma.mediaAsset.updateMany({
        where: {
          publicId,
          status: {
            in: [
              MediaStatus.READY,
              MediaStatus.DELETING,
              MediaStatus.DELETE_FAILED,
            ],
          },
        },
        data: { status: MediaStatus.DELETED, deletedAt: new Date() },
      });
    }
  }
}

function asRecord(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function readString(value: Prisma.JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
