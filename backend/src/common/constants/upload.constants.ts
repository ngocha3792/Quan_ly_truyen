export const BYTES_PER_KILOBYTE = 1_024;
export const BYTES_PER_MEGABYTE =
  BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;

export const DEFAULT_MAX_UPLOAD_SIZE_BYTES =
  10 * BYTES_PER_MEGABYTE;
export const DEFAULT_MAX_IMAGE_SIZE_BYTES =
  5 * BYTES_PER_MEGABYTE;

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const IMAGE_FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
export type ImageFileExtension =
  (typeof IMAGE_FILE_EXTENSIONS)[number];
