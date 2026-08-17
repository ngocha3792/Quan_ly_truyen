import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import {
  MediaAsset,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
} from '@/generated/prisma/client';
import {
  InvalidInputException,
  InvalidStateTransitionException,
  PayloadTooLargeException,
  ResourceGoneException,
  ResourceNotFoundException,
  StorageException,
  UnsupportedMediaTypeException,
} from '@/common/exceptions';
import type { AuthPrincipal } from '@/common/interfaces/auth';
import { PrismaService } from '@/infrastructure/database/prisma';
import {
  MEDIA_STORAGE,
  MediaStoragePort,
} from '../../application/ports/media-storage.port';
import type { SignedUploadParameters } from '../../application/ports/signed-upload.interface';
import type {
  MediaStorageResourceType,
  StoredMedia,
} from '../../application/ports/stored-media.interface';
import type { ConfirmMediaUploadInput, CreateMediaUploadIntentInput, MediaPurposeName } from '../../application/dto';
import type { MediaCommandPort } from '../../application/ports';
import { MEDIA_ERROR_CODES } from '../../domain/exceptions/media-error-codes';
import { MediaPublicIdPolicy } from '../../domain/policies/media-public-id.policy';
import {
  MEDIA_UPLOAD_POLICIES,
  MediaUploadPolicy,
} from '../../domain/policies/media-upload-policy.registry';
import { PrismaMediaOwnershipAdapter } from '../persistence/prisma-media-ownership.adapter';

@Injectable()
export class PrismaMediaCommandAdapter implements MediaCommandPort {
  private readonly logger = new Logger(PrismaMediaCommandAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStoragePort,
    private readonly configService: ConfigService,
    private readonly publicIdService: MediaPublicIdPolicy,
    private readonly ownership: PrismaMediaOwnershipAdapter,
  ) {}

  async createUploadIntent(
    input: CreateMediaUploadIntentInput,
  ): Promise<SignedUploadParameters> {
    const policy = MEDIA_UPLOAD_POLICIES[input.purpose as MediaPurposeName];
    this.validateDeclaredFile(input, policy);
    await this.ownership.assertCanCreate(
      input.principal,
      input.purpose,
      input.ownerId,
    );

    const mediaAssetId = randomUUID();
    const publicId = this.publicIdService.build(
      mediaAssetId,
      input.originalName,
      policy,
    );
    const rootFolder = this.configService.get<string>(
      'cloudinary.rootFolder',
      'quan-ly-truyen',
    );
    const assetFolder = [rootFolder, policy.folderSegment, input.ownerId].join(
      '/',
    );
    const ttlSeconds = this.configService.get<number>(
      'cloudinary.uploadIntentTtlSeconds',
      300,
    );
    const confirmExpiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.mediaAsset.create({
      data: {
        id: mediaAssetId,
        uploaderId: input.principal.userId,
        purpose: input.purpose,
        status: MediaStatus.PENDING,
        storageProvider: 'cloudinary',
        publicId,
        resourceType: toPrismaResourceType(policy.resourceType),
        assetFolder,
        originalName: input.originalName,
        mimeType: input.declaredMimeType.toLowerCase(),
        sizeBytes: BigInt(input.declaredSizeBytes),
        uploadExpiresAt: confirmExpiresAt,
        metadata: { ownerId: input.ownerId },
      },
    });

    try {
      const signed = this.mediaStorage.createSignedUpload({
        mediaAssetId,
        purpose: input.purpose as MediaPurposeName,
        publicId,
        assetFolder,
        resourceType: policy.resourceType,
        confirmExpiresAt,
      });
      this.logger.log({
        message: 'media upload intent created',
        mediaAssetId,
        purpose: input.purpose,
        resourceType: policy.resourceType,
      });
      return signed;
    } catch (error: unknown) {
      await this.prisma.mediaAsset.delete({ where: { id: mediaAssetId } });
      throw error;
    }
  }

  async confirmUpload(input: {
    principal: AuthPrincipal;
    mediaAssetId: string;
    dto: ConfirmMediaUploadInput;
  }): Promise<MediaAsset> {
    const media = await this.requireMedia(input.mediaAssetId);
    this.ownership.assertUploader(input.principal, media.uploaderId);
    if (media.status === MediaStatus.READY) return media;
    if (media.uploadExpiresAt && media.uploadExpiresAt.getTime() < Date.now()) {
      await this.prisma.mediaAsset.updateMany({
        where: {
          id: media.id,
          status: { in: [MediaStatus.PENDING, MediaStatus.PROCESSING] },
        },
        data: { status: MediaStatus.FAILED },
      });
      throw new ResourceGoneException({
        code: MEDIA_ERROR_CODES.INTENT_EXPIRED,
        resource: 'media upload intent',
        identifier: media.id,
      });
    }
    if (
      input.dto.publicId !== media.publicId ||
      input.dto.resourceType !== media.resourceType?.toLowerCase()
    ) {
      await this.prisma.mediaAsset.updateMany({
        where: {
          id: media.id,
          status: { in: [MediaStatus.PENDING, MediaStatus.UPLOADED] },
        },
        data: {
          status: MediaStatus.FAILED,
          lastProviderErrorCode: MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
        },
      });
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
        message: 'Thông tin xác nhận upload không khớp intent',
      });
    }

    const claim = await this.prisma.mediaAsset.updateMany({
      where: {
        id: media.id,
        status: { in: [MediaStatus.PENDING, MediaStatus.UPLOADED] },
      },
      data: {
        status: MediaStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });
    if (claim.count !== 1) {
      const current = await this.requireMedia(media.id);
      if (current.status === MediaStatus.READY) return current;
      throw new InvalidStateTransitionException({
        resource: 'media upload intent',
        from: current.status,
        to: MediaStatus.READY,
      });
    }

    try {
      const stored = await this.mediaStorage.confirmUpload({
        publicId: input.dto.publicId,
        version: input.dto.version,
        responseSignature: input.dto.signature,
        resourceType: input.dto.resourceType,
      });
      this.validateAuthoritativeAsset(media, stored);
      const readyAt = new Date();
      const updated = await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: MediaStatus.PROCESSING },
        data: {
          status: MediaStatus.READY,
          providerAssetId: stored.providerAssetId,
          version: stored.version,
          deliveryType: stored.deliveryType,
          format: stored.format,
          secureUrl: stored.secureUrl,
          sizeBytes: BigInt(stored.bytes),
          width: stored.width,
          height: stored.height,
          duration: stored.duration,
          uploadedAt: readyAt,
          readyAt,
          processingStartedAt: null,
          lastProviderErrorCode: null,
        },
      });
      if (updated.count !== 1)
        throw new InvalidStateTransitionException({
          resource: 'media upload intent',
          from: MediaStatus.PROCESSING,
          to: MediaStatus.READY,
        });
      this.logger.log({
        message: 'media upload confirmed',
        mediaAssetId: media.id,
        purpose: media.purpose,
      });
      return this.requireMedia(media.id);
    } catch (error: unknown) {
      await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: MediaStatus.PROCESSING },
        data: {
          status: MediaStatus.FAILED,
          processingStartedAt: null,
          lastProviderErrorCode:
            error instanceof StorageException
              ? String(error.code)
              : MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
          metadata: mergeMetadata(media.metadata, {
            providerOperation: 'confirm',
            errorCode:
              error instanceof StorageException
                ? error.code
                : MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
            failedAt: new Date().toISOString(),
          }),
        },
      });
      throw error;
    }
  }

  private async requireMedia(id: string): Promise<MediaAsset> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media)
      throw new ResourceNotFoundException({
        code: MEDIA_ERROR_CODES.INTENT_NOT_FOUND,
        resource: 'media upload intent',
        identifier: id,
      });
    return media;
  }

  private validateDeclaredFile(
    input: CreateMediaUploadIntentInput,
    policy: MediaUploadPolicy,
  ): void {
    const mime = input.declaredMimeType.toLowerCase();
    if (input.declaredSizeBytes <= 0)
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.POLICY_VIOLATION,
        message: 'Kích thước tệp phải lớn hơn 0',
      });
    if (input.declaredSizeBytes > policy.maxBytes)
      throw new PayloadTooLargeException({
        actualBytes: input.declaredSizeBytes,
        maxBytes: policy.maxBytes,
      });
    if (!policy.allowedMimeTypes.includes(mime))
      throw new UnsupportedMediaTypeException({
        received: mime,
        supported: policy.allowedMimeTypes,
      });
    const extension = this.publicIdService.getExtension(
      input.originalName,
      policy,
    );
    if (!policy.mimeFormatPairs[mime]?.includes(extension))
      throw new UnsupportedMediaTypeException({
        received: `${mime}; extension=${extension}`,
        supported: policy.mimeFormatPairs[mime],
      });
  }

  private validateAuthoritativeAsset(
    pending: MediaAsset,
    stored: StoredMedia,
  ): void {
    const policy = MEDIA_UPLOAD_POLICIES[pending.purpose];
    if (
      !stored.providerAssetId ||
      stored.publicId !== pending.publicId ||
      stored.resourceType !== policy.resourceType ||
      stored.deliveryType !== 'upload' ||
      stored.assetFolder !== pending.assetFolder ||
      !Number.isSafeInteger(stored.version) ||
      stored.version <= 0 ||
      !stored.secureUrl.startsWith('https://')
    ) {
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
        message: 'Asset Cloudinary không khớp upload intent',
      });
    }
    const format = (
      stored.format ??
      this.publicIdService.getExtension(pending.originalName ?? '', policy)
    ).toLowerCase();
    if (!policy.allowedFormats.includes(format))
      throw new UnsupportedMediaTypeException({
        received: format,
        supported: policy.allowedFormats,
      });
    if (
      !Number.isSafeInteger(stored.bytes) ||
      stored.bytes <= 0 ||
      stored.bytes > policy.maxBytes
    )
      throw new PayloadTooLargeException({
        actualBytes: stored.bytes,
        maxBytes: policy.maxBytes,
      });
  }
}

export function toPrismaResourceType(
  value: MediaStorageResourceType,
): MediaResourceType {
  const map: Record<MediaStorageResourceType, MediaResourceType> = {
    image: MediaResourceType.IMAGE,
    video: MediaResourceType.VIDEO,
    raw: MediaResourceType.RAW,
  };
  return map[value];
}

function mergeMetadata(
  existing: Prisma.JsonValue | null,
  extra: Record<string, string>,
): Prisma.InputJsonObject {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? existing
      : {};
  return { ...base, ...extra };
}
