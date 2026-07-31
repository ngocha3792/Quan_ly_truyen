import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

import { timingSafeStringEqual } from '@/common/utils/timing-safe-string-equal.util';

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
    private readonly cloudinary: CloudinaryClient,
    private readonly configService: ConfigService,
    private readonly signatureService: CloudinarySignatureService,
    private readonly urlService: CloudinaryUrlService,
  ) {}

  createSignedUpload(
    input: CreateSignedUploadInput,
  ): SignedUploadParameters {
    return this.signatureService.createSignedUpload(input);
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<StoredMedia> {
    this.verifyUploadResponseSignature(input);

    const authoritative = await this.cloudinary.api.resource(
      input.publicId,
      {
        resource_type: input.resourceType,
        type: 'upload',
      },
    );

    return mapCloudinaryAsset(authoritative as UploadApiResponse);
  }

  async uploadBuffer(input: {
    buffer: Buffer;
    publicId: string;
    assetFolder: string;
    resourceType: 'image' | 'video' | 'raw';
    uploadPreset?: string;
  }): Promise<StoredMedia> {
    const options: UploadApiOptions = {
      public_id: input.publicId,
      asset_folder: input.assetFolder,
      resource_type: input.resourceType,
      upload_preset: input.uploadPreset,
      overwrite: false,
    };

    const result = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const stream = this.cloudinary.uploader.upload_stream(
          options,
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error('Cloudinary returned no upload result'));
              return;
            }

            resolve(uploadResult);
          },
        );

        stream.end(input.buffer);
      },
    );

    return mapCloudinaryAsset(result);
  }

  async delete(input: DeleteStoredMediaInput): Promise<void> {
    const result = await this.cloudinary.uploader.destroy(
      input.publicId,
      {
        resource_type: input.resourceType,
        type: 'upload',
        invalidate: input.invalidate ?? true,
      },
    );

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(
        `Cloudinary delete failed: ${String(result.result)}`,
      );
    }
  }

  buildUrl(input: BuildMediaUrlInput): string {
    return this.urlService.build(input);
  }

  private verifyUploadResponseSignature(input: ConfirmUploadInput): void {
    const apiSecret = this.configService.getOrThrow<string>(
      'cloudinary.apiSecret',
    );

    const expected = this.cloudinary.utils.api_sign_request(
      {
        public_id: input.publicId,
        version: input.version,
      },
      apiSecret,
    );

    if (!timingSafeStringEqual(expected, input.responseSignature)) {
      throw new Error('Invalid Cloudinary upload response signature');
    }
  }
}
