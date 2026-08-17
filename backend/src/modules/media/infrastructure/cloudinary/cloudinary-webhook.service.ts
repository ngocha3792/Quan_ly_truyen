import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { InvalidInputException, StorageException } from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database/prisma';
import { MetricsService } from '@/infrastructure/observability';
import { MEDIA_ERROR_CODES } from '../../application/errors/media-error-codes';
import {
  CloudinaryWebhookSignatureException,
  MediaStorageDisabledException,
} from '../../application/errors/media.exceptions';
import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import type { CloudinaryClient } from './cloudinary.provider';

@Injectable()
export class CloudinaryWebhookService {
  private readonly logger = new Logger(CloudinaryWebhookService.name);
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinary: CloudinaryClient | null,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async handle(input: {
    rawBody: Buffer;
    timestamp: string;
    signature: string;
  }): Promise<{ duplicate: boolean; eventKey: string }> {
    if (
      !this.cloudinary ||
      !this.configService.get<boolean>('cloudinary.enabled', false)
    ) {
      throw new MediaStorageDisabledException('Cloudinary webhook đang bị tắt');
    }
    const timestamp = Number(input.timestamp);
    const validFor = this.configService.get<number>(
      'cloudinary.webhookSignatureTtlSeconds',
      300,
    );
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      Math.abs(nowSeconds - timestamp) > validFor
    ) {
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
        message: 'Cloudinary webhook timestamp không hợp lệ hoặc đã hết hạn',
      });
    }
    const rawText = input.rawBody.toString('utf8');
    const valid = this.cloudinary.utils.verifyNotificationSignature(
      rawText,
      timestamp,
      input.signature,
      validFor,
    );
    if (!valid) throw new CloudinaryWebhookSignatureException();

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new InvalidInputException({
          code: MEDIA_ERROR_CODES.WEBHOOK_PAYLOAD_INVALID,
          message: 'Payload Cloudinary webhook phải là JSON object',
        });
      }
      payload = parsed as Record<string, unknown>;
    } catch (error: unknown) {
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.WEBHOOK_PAYLOAD_INVALID,
        message: 'Payload Cloudinary webhook không hợp lệ',
        cause: error,
      });
    }
    const payloadHash = createHash('sha256')
      .update('cloudinary:')
      .update(input.rawBody)
      .digest('hex');
    const providerKey = payload.notification_id ?? payload.id;
    const eventKey =
      typeof providerKey === 'string' &&
      providerKey.trim().length > 0 &&
      providerKey.length <= 255
        ? providerKey.trim()
        : payloadHash;
    const eventTypeValue =
      payload.notification_type ?? payload.event_type ?? payload.type;
    const eventType = readRequiredString(eventTypeValue, 'notification_type');
    if (eventType.length > 120) {
      throw invalidWebhookPayload('notification_type vượt quá 120 ký tự');
    }
    validateAssetEventPayload(eventType, payload);
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          provider: 'cloudinary',
          eventKey,
          payloadHash,
          eventType,
          payload: payload as Prisma.InputJsonObject,
        },
      });
      this.metrics.recordWebhook(eventType, 'success');
      this.logger.log({
        message: 'cloudinary webhook accepted',
        eventKey,
        eventType,
      });
      return { duplicate: false, eventKey };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.metrics.recordWebhook(eventType, 'replay');
        this.logger.log({
          message: 'cloudinary webhook duplicate',
          eventKey,
          eventType,
        });
        return { duplicate: true, eventKey };
      }
      this.metrics.recordWebhook(eventType, 'failed');
      throw new StorageException({
        provider: 'postgresql',
        operation: 'persist-webhook-inbox',
        cause: error,
        retryable: true,
      });
    }
  }
}

const ASSET_EVENT_TYPES = new Set([
  'upload',
  'resource_created',
  'resource_uploaded',
  'delete',
  'resource_deleted',
]);

function validateAssetEventPayload(
  eventType: string,
  payload: Record<string, unknown>,
): void {
  if (!ASSET_EVENT_TYPES.has(eventType.toLowerCase())) return;
  readRequiredString(payload.public_id, 'public_id');
  const resourceType = readRequiredString(
    payload.resource_type,
    'resource_type',
  ).toLowerCase();
  if (!['image', 'video', 'raw'].includes(resourceType)) {
    throw invalidWebhookPayload('resource_type không được hỗ trợ');
  }
  if (
    payload.version !== undefined &&
    (!Number.isSafeInteger(payload.version) || Number(payload.version) <= 0)
  ) {
    throw invalidWebhookPayload('version không hợp lệ');
  }
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidWebhookPayload(`${field} là bắt buộc`);
  }
  return value.trim();
}

function invalidWebhookPayload(message: string): InvalidInputException {
  return new InvalidInputException({
    code: MEDIA_ERROR_CODES.WEBHOOK_PAYLOAD_INVALID,
    message,
  });
}
