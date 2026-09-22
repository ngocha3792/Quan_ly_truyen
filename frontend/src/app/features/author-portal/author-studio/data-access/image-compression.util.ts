export interface ImageCompressionOptions {
  readonly maxDimension: number;
  readonly quality: number;
  readonly mimeType?: 'image/webp' | 'image/jpeg';
}

const SKIPPED_MIME_TYPES = new Set(['image/gif', 'image/svg+xml']);

/**
 * Resizes and re-encodes an image client-side before upload so a raw
 * camera/screenshot capture (often several MB) doesn't get pushed to
 * storage as-is. Falls back to the original file whenever compression
 * isn't possible or doesn't actually shrink the file.
 */
export async function compressImageForUpload(
  file: File,
  options: ImageCompressionOptions,
): Promise<File> {
  if (!canCompress(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithinDimension(
      bitmap.width,
      bitmap.height,
      options.maxDimension,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const mimeType = options.mimeType ?? 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, options.quality),
    );

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], renameExtension(file.name, mimeType), {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function canCompress(file: File): boolean {
  return (
    typeof createImageBitmap !== 'undefined' &&
    file.type.startsWith('image/') &&
    !SKIPPED_MIME_TYPES.has(file.type)
  );
}

function fitWithinDimension(
  width: number,
  height: number,
  maxDimension: number,
): { readonly width: number; readonly height: number } {
  const largestSide = Math.max(width, height);
  if (largestSide <= maxDimension) return { width, height };

  const scale = maxDimension / largestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function renameExtension(name: string, mimeType: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';
  return `${base}.${extension}`;
}
