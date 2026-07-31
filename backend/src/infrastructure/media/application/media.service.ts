import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MediaPurpose, MediaStatus, MediaAsset } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';

import {
  MEDIA_STORAGE,
  MediaStoragePort,
} from '../contracts/media-storage.port';
import type { SignedUploadParameters } from '../contracts/signed-upload.interface';
import type { StoredMedia } from '../contracts/stored-media.interface';
import type { ConfirmMediaUploadDto } from '../dto/confirm-media-upload.dto';
import {
  MEDIA_UPLOAD_POLICIES,
  MediaUploadPolicy,
} from '../policies/media-upload-policy.registry';

export interface CreateMediaUploadIntentInput {
  uploaderId: string;
  purpose: MediaPurpose;
  ownerId: string;
  originalName: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE)
    private readonly mediaStorage: MediaStoragePort,
    private readonly configService: ConfigService,
  ) {}

  async createUploadIntent(
    input: CreateMediaUploadIntentInput,
  ): Promise<SignedUploadParameters> {
    const policy = MEDIA_UPLOAD_POLICIES[input.purpose];

    this.validateDeclaredFile(input, policy);

    const ttlSeconds = this.configService.get<number>(
      'cloudinary.uploadIntentTtlSeconds',
      300,
    );

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const media = await this.prisma.mediaAsset.create({
      data: {
        uploaderId: input.uploaderId,
        purpose: input.purpose,
        status: MediaStatus.PENDING,
        storageProvider: 'cloudinary',
        originalName: input.originalName,
        mimeType: input.declaredMimeType,
        sizeBytes: BigInt(input.declaredSizeBytes),
        uploadExpiresAt: expiresAt,
        metadata: {
          ...input.metadata,
          ownerId: input.ownerId,
        },
      },
    });

    return this.mediaStorage.createSignedUpload({
      mediaAssetId: media.id,
      purpose: media.purpose,
      ownerId: input.ownerId,
      expiresAt,
    });
  }

  async confirmUpload(input: {
    userId: string;
    dto: ConfirmMediaUploadDto;
  }): Promise<MediaAsset> {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: input.dto.mediaAssetId },
    });

    if (!media) {
      throw new Error('Media upload intent not found');
    }

    if (media.uploaderId !== input.userId) {
      throw new Error('Media upload intent does not belong to user');
    }

    if (media.status === MediaStatus.READY) {
      return media;
    }

    if (media.status !== MediaStatus.PENDING) {
      throw new Error(`Cannot confirm media in ${media.status}`);
    }

    if (
      !media.uploadExpiresAt ||
      media.uploadExpiresAt.getTime() < Date.now()
    ) {
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: MediaStatus.FAILED },
      });

      throw new Error('Media upload intent has expired');
    }

    if (input.dto.publicId !== media.id) {
      throw new Error('Cloudinary public ID does not match intent');
    }

    const stored = await this.mediaStorage.confirmUpload({
      publicId: input.dto.publicId,
      version: input.dto.version,
      responseSignature: input.dto.signature,
      resourceType: input.dto.resourceType,
    });

    this.validateAuthoritativeAsset(media, stored);

    return this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: MediaStatus.READY,
        providerAssetId: stored.providerAssetId,
        publicId: stored.publicId,
        version: stored.version,
        resourceType: stored.resourceType.toUpperCase() as any,
        deliveryType: stored.deliveryType,
        format: stored.format,
        assetFolder: stored.assetFolder,
        secureUrl: stored.secureUrl,
        sizeBytes: BigInt(stored.bytes),
        width: stored.width,
        height: stored.height,
        duration: stored.duration,
        uploadedAt: new Date(),
        readyAt: new Date(),
      },
    });
  }

  private validateDeclaredFile(
    input: CreateMediaUploadIntentInput,
    policy: MediaUploadPolicy,
  ): void {
    if (input.declaredSizeBytes <= 0) {
      throw new Error('File size must be greater than zero');
    }

    if (input.declaredSizeBytes > policy.maxBytes) {
      throw new Error('Declared file size exceeds policy');
    }
  }

  private validateAuthoritativeAsset(
    pending: MediaAsset,
    stored: StoredMedia,
  ): void {
    const policy = MEDIA_UPLOAD_POLICIES[pending.purpose];

    if (stored.resourceType !== policy.resourceType) {
      throw new Error('Unexpected Cloudinary resource type');
    }

    if (
      policy.allowedFormats.length > 0 &&
      !policy.allowedFormats.includes(stored.format.toLowerCase())
    ) {
      throw new Error('Unexpected Cloudinary media format');
    }

    if (stored.bytes > policy.maxBytes) {
      throw new Error('Cloudinary asset exceeds media policy');
    }

    if (stored.publicId !== pending.id) {
      throw new Error('Cloudinary asset identity mismatch');
    }
  }
}
