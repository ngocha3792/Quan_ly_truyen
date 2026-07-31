import { MediaPurpose } from '@/generated/prisma/client';

export interface MediaUploadPolicy {
  resourceType: 'image' | 'video' | 'raw';
  uploadPresetConfigKey: string;
  folderSegment: string;
  allowedFormats: readonly string[];
  maxBytes: number;
}

const MB = 1024 * 1024;

export const MEDIA_UPLOAD_POLICIES: Record<
  MediaPurpose,
  MediaUploadPolicy
> = {
  [MediaPurpose.AVATAR]: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.avatar',
    folderSegment: 'users/avatars',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxBytes: 5 * MB,
  },

  [MediaPurpose.AUTHOR_BANNER]: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.authorBanner',
    folderSegment: 'authors/banners',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxBytes: 10 * MB,
  },

  [MediaPurpose.STORY_COVER]: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.storyCover',
    folderSegment: 'stories/covers',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxBytes: 10 * MB,
  },

  [MediaPurpose.CHAPTER_IMAGE]: {
    resourceType: 'image',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.chapterImage',
    folderSegment: 'stories/chapters',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxBytes: 15 * MB,
  },

  [MediaPurpose.ATTACHMENT]: {
    resourceType: 'raw',
    uploadPresetConfigKey: 'cloudinary.uploadPresets.attachment',
    folderSegment: 'attachments',
    allowedFormats: [],
    maxBytes: 10 * MB,
  },
};
