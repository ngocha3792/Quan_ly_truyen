import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvalidInputException } from '@/common/exceptions';

import type { CreateSignedUploadInput } from '../contracts/media-storage.port';
import type { SignedUploadParameters } from '../contracts/signed-upload.interface';
import { MEDIA_UPLOAD_POLICIES } from '../policies/media-upload-policy.registry';
import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import type { CloudinaryClient } from './cloudinary.provider';
import { MediaStorageDisabledException } from '../media.exceptions';

@Injectable()
export class CloudinarySignatureService {
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinary: CloudinaryClient | null,
    private readonly configService: ConfigService,
  ) {}

  createSignedUpload(input: CreateSignedUploadInput): SignedUploadParameters {
    const policy = MEDIA_UPLOAD_POLICIES[input.purpose];

    if (!policy) {
      throw new InvalidInputException({
        message: `Media purpose không được hỗ trợ: ${input.purpose}`,
      });
    }

    const cloudName = this.configService.getOrThrow<string>(
      'cloudinary.cloudName',
    );
    const apiKey = this.configService.getOrThrow<string>('cloudinary.apiKey');
    const apiSecret = this.configService.getOrThrow<string>(
      'cloudinary.apiSecret',
    );
    const uploadPreset = this.configService.getOrThrow<string>(
      policy.uploadPresetConfigKey,
    );

    const timestamp = Math.floor(Date.now() / 1000);
    if (!this.cloudinary) {
      throw new MediaStorageDisabledException();
    }

    const parameters = {
      timestamp,
      upload_preset: uploadPreset,
      public_id: input.publicId,
      asset_folder: input.assetFolder,
      overwrite: false,
      tags: `quan-ly-truyen,${input.purpose.toLowerCase()}`,
    } as const;

    const signature = this.cloudinary.utils.api_sign_request(
      parameters,
      apiSecret,
    );

    return {
      mediaAssetId: input.mediaAssetId,
      uploadUrl: [
        'https://api.cloudinary.com/v1_1',
        cloudName,
        input.resourceType,
        'upload',
      ].join('/'),
      cloudName,
      apiKey,
      signature,
      timestamp,
      resourceType: input.resourceType,
      confirmExpiresAt: input.confirmExpiresAt.toISOString(),
      parameters: {
        upload_preset: uploadPreset,
        public_id: input.publicId,
        asset_folder: input.assetFolder,
        overwrite: false,
        tags: parameters.tags,
      },
    };
  }
}
