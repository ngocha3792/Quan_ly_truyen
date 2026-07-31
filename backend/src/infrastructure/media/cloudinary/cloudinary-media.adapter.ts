import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

import { timingSafeStringEqual } from '@/common/utils/timing-safe-string-equal.util';
import { InvalidInputException, StorageException } from '@/common/exceptions';
import { MEDIA_ERROR_CODES } from '../media-error-codes';

import type {
  BuildMediaUrlInput,
  ConfirmUploadInput,
  CreateSignedUploadInput,
  DeleteStoredMediaInput,
  MediaStoragePort,
} from '../contracts/media-storage.port';
import type { SignedUploadParameters } from '../contracts/signed-upload.interface';
import type { StoredMedia } from '../contracts/stored-media.interface';

import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import type { CloudinaryClient } from './cloudinary.provider';
import { mapCloudinaryAsset } from './cloudinary-response.mapper';
import { CloudinarySignatureService } from './cloudinary-signature.service';
import { CloudinaryUrlService } from './cloudinary-url.service';

@Injectable()
export class CloudinaryMediaAdapter implements MediaStoragePort {
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinary: CloudinaryClient | null,
    private readonly configService: ConfigService,
    private readonly signatureService: CloudinarySignatureService,
    private readonly urlService: CloudinaryUrlService,
  ) {}

  createSignedUpload(input: CreateSignedUploadInput): SignedUploadParameters {
    return this.signatureService.createSignedUpload(input);
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<StoredMedia> {
    const client = this.requireClient('confirm');
    this.verifyUploadResponseSignature(input, client);
    try {
      const authoritative: unknown = await client.api.resource(input.publicId, {
        resource_type: input.resourceType,
        type: 'upload',
      });
      return mapCloudinaryAsset(authoritative);
    } catch (error: unknown) {
      if (
        error instanceof InvalidInputException ||
        error instanceof StorageException
      )
        throw error;
      throw new StorageException({
        code: MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
        provider: 'cloudinary',
        operation: 'resource',
        cause: error,
        retryable: true,
      });
    }
  }

  async uploadBuffer(input: {
    buffer: Buffer;
    publicId: string;
    assetFolder: string;
    resourceType: 'image' | 'video' | 'raw';
    uploadPreset?: string;
  }): Promise<StoredMedia> {
    const client = this.requireClient('upload');
    const options: UploadApiOptions = {
      public_id: input.publicId,
      asset_folder: input.assetFolder,
      resource_type: input.resourceType,
      upload_preset: input.uploadPreset,
      overwrite: false,
    };

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = client.uploader.upload_stream(
        options,
        (error, uploadResult) => {
          if (error) {
            reject(
              new StorageException({
                provider: 'cloudinary',
                operation: 'upload',
                cause: error,
                retryable: true,
              }),
            );
            return;
          }

          if (!uploadResult) {
            reject(
              new StorageException({
                provider: 'cloudinary',
                operation: 'upload',
                message: 'Cloudinary không trả kết quả upload',
                retryable: true,
              }),
            );
            return;
          }

          resolve(uploadResult);
        },
      );

      stream.end(input.buffer);
    });

    return mapCloudinaryAsset(result);
  }

  async delete(input: DeleteStoredMediaInput): Promise<void> {
    const client = this.requireClient('delete');
    try {
      const result: unknown = await client.uploader.destroy(input.publicId, {
        resource_type: input.resourceType,
        type: 'upload',
        invalidate: input.invalidate ?? true,
      });
      const outcome = getDeleteOutcome(result);
      if (outcome !== 'ok' && outcome !== 'not found') {
        throw new StorageException({
          code: MEDIA_ERROR_CODES.DELETE_FAILED,
          provider: 'cloudinary',
          operation: 'delete',
          storageKey: input.publicId,
          retryable: true,
        });
      }
    } catch (error: unknown) {
      if (error instanceof StorageException) throw error;
      throw new StorageException({
        code: MEDIA_ERROR_CODES.DELETE_FAILED,
        provider: 'cloudinary',
        operation: 'delete',
        storageKey: input.publicId,
        cause: error,
        retryable: true,
      });
    }
  }

  buildUrl(input: BuildMediaUrlInput): string {
    return this.urlService.build(input);
  }

  private verifyUploadResponseSignature(
    input: ConfirmUploadInput,
    client: CloudinaryClient,
  ): void {
    const apiSecret = this.configService.getOrThrow<string>(
      'cloudinary.apiSecret',
    );

    const expected = client.utils.api_sign_request(
      {
        public_id: input.publicId,
        version: input.version,
      },
      apiSecret,
    );

    if (!timingSafeStringEqual(expected, input.responseSignature)) {
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.CONFIRMATION_INVALID,
        message: 'Chữ ký xác nhận upload không hợp lệ',
      });
    }
  }

  private requireClient(operation: string): CloudinaryClient {
    if (!this.cloudinary)
      throw new StorageException({
        code: MEDIA_ERROR_CODES.STORAGE_DISABLED,
        provider: 'cloudinary',
        operation,
        message: 'Dịch vụ Cloudinary đang bị tắt',
        retryable: false,
      });
    return this.cloudinary;
  }
}

function getDeleteOutcome(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'result' in value &&
    typeof value.result === 'string'
  )
    return value.result;
  throw new StorageException({
    code: MEDIA_ERROR_CODES.DELETE_FAILED,
    provider: 'cloudinary',
    operation: 'delete',
    message: 'Cloudinary trả kết quả xóa không hợp lệ',
    retryable: true,
  });
}
