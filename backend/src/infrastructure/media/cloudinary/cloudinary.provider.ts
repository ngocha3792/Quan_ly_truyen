import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import { MetricsService } from '@/infrastructure/observability';

export type CloudinaryClient = typeof cloudinary;

export const cloudinaryProvider: Provider = {
  provide: CLOUDINARY_CLIENT,
  inject: [ConfigService, MetricsService],

  useFactory: (
    configService: ConfigService,
    metrics: MetricsService,
  ): CloudinaryClient | null => {
    const enabled = configService.get<boolean>('cloudinary.enabled', false);

    if (!enabled) {
      metrics.setDependencyHealth('cloudinary', 'disabled');
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
    metrics.setDependencyHealth('cloudinary', 'configured');

    return cloudinary;
  },
};
