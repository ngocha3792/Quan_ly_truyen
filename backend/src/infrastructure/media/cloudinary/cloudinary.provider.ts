import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { CLOUDINARY_CLIENT } from './cloudinary.constants';

export type CloudinaryClient = typeof cloudinary;

export const cloudinaryProvider: Provider = {
  provide: CLOUDINARY_CLIENT,
  inject: [ConfigService],

  useFactory: (configService: ConfigService): CloudinaryClient | null => {
    const enabled = configService.get<boolean>('cloudinary.enabled', false);

    if (!enabled) {
      return null;
    }

    const cloudName = configService.getOrThrow<string>('cloudinary.cloudName');
    const apiKey = configService.getOrThrow<string>('cloudinary.apiKey');
    const apiSecret = configService.getOrThrow<string>('cloudinary.apiSecret');
    const signatureAlgorithm = configService.get<string>(
      'cloudinary.signatureAlgorithm',
      'sha256',
    );

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
      signature_algorithm: signatureAlgorithm,
    });

    return cloudinary;
  },
};
