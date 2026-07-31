import type { SignedUploadParameters } from './signed-upload.interface';
import type {
  MediaStorageResourceType,
  StoredMedia,
} from './stored-media.interface';

export const MEDIA_STORAGE = Symbol.for(
  'quan-ly-truyen.infrastructure.media-storage',
);

export interface CreateSignedUploadInput {
  mediaAssetId: string;
  purpose:
    'AVATAR' | 'AUTHOR_BANNER' | 'STORY_COVER' | 'CHAPTER_IMAGE' | 'ATTACHMENT';
  publicId: string;
  assetFolder: string;
  resourceType: MediaStorageResourceType;
  confirmExpiresAt: Date;
}

export interface ConfirmUploadInput {
  publicId: string;
  version: number;
  responseSignature: string;
  resourceType: MediaStorageResourceType;
}

export interface DeleteStoredMediaInput {
  publicId: string;
  resourceType: MediaStorageResourceType;
  invalidate?: boolean;
}

export interface DeleteStoredMediaResult {
  outcome: 'deleted' | 'not_found';
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
  createSignedUpload(input: CreateSignedUploadInput): SignedUploadParameters;

  confirmUpload(input: ConfirmUploadInput): Promise<StoredMedia>;

  uploadBuffer(input: {
    buffer: Buffer;
    publicId: string;
    assetFolder: string;
    resourceType: MediaStorageResourceType;
    uploadPreset?: string;
  }): Promise<StoredMedia>;

  delete(input: DeleteStoredMediaInput): Promise<DeleteStoredMediaResult>;

  buildUrl(input: BuildMediaUrlInput): string;
}
