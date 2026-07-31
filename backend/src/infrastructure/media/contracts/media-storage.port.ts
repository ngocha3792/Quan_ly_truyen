import type { SignedUploadParameters } from './signed-upload.interface';
import type { StoredMedia } from './stored-media.interface';

export const MEDIA_STORAGE = Symbol.for(
  'quan-ly-truyen.infrastructure.media-storage',
);

export interface CreateSignedUploadInput {
  mediaAssetId: string;
  purpose:
    | 'AVATAR'
    | 'AUTHOR_BANNER'
    | 'STORY_COVER'
    | 'CHAPTER_IMAGE'
    | 'ATTACHMENT'
    | string;
  ownerId: string;
  expiresAt: Date;
}

export interface ConfirmUploadInput {
  publicId: string;
  version: number;
  responseSignature: string;
  resourceType: 'image' | 'video' | 'raw';
}

export interface DeleteStoredMediaInput {
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
  invalidate?: boolean;
}

export interface BuildMediaUrlInput {
  publicId: string;
  resourceType: 'image' | 'video';
  preset:
  | 'avatar'
  | 'authorBanner'
  | 'storyCover'
  | 'storyThumbnail'
  | 'chapterImage';
}

export interface MediaStoragePort {
  createSignedUpload(
    input: CreateSignedUploadInput,
  ): SignedUploadParameters;

  confirmUpload(input: ConfirmUploadInput): Promise<StoredMedia>;

  uploadBuffer(input: {
    buffer: Buffer;
    publicId: string;
    assetFolder: string;
    resourceType: 'image' | 'video' | 'raw';
    uploadPreset?: string;
  }): Promise<StoredMedia>;

  delete(input: DeleteStoredMediaInput): Promise<void>;

  buildUrl(input: BuildMediaUrlInput): string;
}
