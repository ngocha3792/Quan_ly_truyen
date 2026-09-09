export function validateChapterImage(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return file.size > 10 * 1024 * 1024 ||
    !['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '') ||
    (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    ? 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP, tối đa 10 MB.'
    : null;
}
