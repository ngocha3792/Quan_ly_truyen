import { AUTHOR_APPLICATION_SAMPLE_FILE_POLICY } from '@/common/policies/author-application-sample-file.policy';
import type { MediaPurposeName } from '../enums/media-purpose';
import type { MediaStorageResourceType } from '../value-objects/media-storage-resource-type';

export interface MediaUploadPolicy {
  resourceType: MediaStorageResourceType;
  uploadPresetConfigKey: string;
  folderSegment: string;
  allowedFormats: readonly string[];
  allowedMimeTypes: readonly string[];
  mimeFormatPairs: Readonly<Record<string, readonly string[]>>;
  maxBytes: number;
}

const MB = 1024 * 1024;

export const MEDIA_UPLOAD_POLICIES: Record<MediaPurposeName, MediaUploadPolicy> = {
  AVATAR: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.avatar',
    folderSegment: 'users/avatars',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    mimeFormatPairs: {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
    },
    maxBytes: 5 * MB,
  },

  AUTHOR_BANNER: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.authorBanner',
    folderSegment: 'authors/banners',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    mimeFormatPairs: {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
    },
    maxBytes: 10 * MB,
  },

  STORY_COVER: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.storyCover',
    folderSegment: 'stories/covers',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    mimeFormatPairs: {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
    },
    maxBytes: 10 * MB,
  },

  CHAPTER_IMAGE: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.chapterImage',
    folderSegment: 'stories/chapters',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    mimeFormatPairs: {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
    },
    maxBytes: 15 * MB,
  },

  GENRE_COVER: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.storyCover',
    folderSegment: 'genres/covers',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    mimeFormatPairs: {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
    },
    maxBytes: 5 * MB,
  },

  AUTHOR_APPLICATION_SAMPLE: {
    resourceType: 'raw',

    uploadPresetConfigKey: 'cloudinary.uploadPresets.attachment',

    folderSegment: 'author-applications/samples',

    allowedFormats: AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.allowedFormats,

    allowedMimeTypes: AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.allowedMimeTypes,

    mimeFormatPairs: AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.mimeFormatPairs,

    maxBytes: AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.maxBytes,
  },

  ATTACHMENT: {
    resourceType: 'raw',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.attachment',
    folderSegment: 'attachments',
    allowedFormats: ['pdf', 'txt', 'doc', 'docx', 'zip'],
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
    ],
    mimeFormatPairs: {
      'application/pdf': ['pdf'],
      'text/plain': ['txt'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['docx'],
      'application/zip': ['zip'],
    },
    maxBytes: 10 * MB,
  },
};
