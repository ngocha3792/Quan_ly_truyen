import { Inject, Injectable } from '@nestjs/common';
import { MediaStorageDisabledException } from '../../application/errors/media.exceptions';

import type { BuildMediaUrlInput } from '../../application/ports/media-storage.port';
import type { MediaUrlPort } from '../../application/ports/media-url.port';
import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import type { CloudinaryClient } from './cloudinary.provider';

@Injectable()
export class CloudinaryUrlService implements MediaUrlPort {
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinary: CloudinaryClient | null,
  ) {}

  build(input: BuildMediaUrlInput): string {
    if (!this.cloudinary) {
      throw new MediaStorageDisabledException();
    }
    const transformation = this.resolveTransformation(input.preset);

    if (input.resourceType === 'video') {
      return this.cloudinary.url(input.publicId, {
        secure: true,
        resource_type: 'video',
        type: 'upload',
        transformation,
      });
    }

    return this.cloudinary.url(input.publicId, {
      secure: true,
      resource_type: 'image',
      type: 'upload',
      transformation,
    });
  }

  private resolveTransformation(
    preset: BuildMediaUrlInput['preset'],
  ): Record<string, unknown>[] {
    switch (preset) {
      case 'avatar':
        return [
          {
            width: 256,
            height: 256,
            crop: 'fill',
            gravity: 'face',
          },
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ];

      case 'authorBanner':
        return [
          {
            width: 1600,
            height: 500,
            crop: 'fill',
            gravity: 'auto',
          },
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ];

      case 'storyCover':
        return [
          {
            width: 600,
            height: 900,
            crop: 'fill',
            gravity: 'auto',
          },
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ];

      case 'storyThumbnail':
        return [
          {
            width: 240,
            height: 360,
            crop: 'fill',
            gravity: 'auto',
          },
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ];

      case 'chapterImage':
        return [
          {
            width: 1600,
            crop: 'limit',
          },
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ];

      case 'genreCover':
      default:
        return [
          {
            width: 600,
            height: 400,
            crop: 'fill',
            gravity: 'auto',
          },
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ];
    }
  }
}
