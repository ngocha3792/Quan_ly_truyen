/**
 * Luật ảnh tải lên, dùng chung cho trang truyện tranh và ảnh bìa.
 *
 * Hai chỗ này từng có hai bản kiểm tra riêng với cùng một bộ luật — sửa một
 * bên là lệch bên kia.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'webp'];
const MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
/** Cùng thứ tự với `MIME_TYPES`. */
const MIME_EXTENSIONS: readonly string[] = ['jpg', 'png', 'webp'];

const FORMAT_MESSAGE = 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.';
const SIZE_MESSAGE = 'Ảnh không được vượt quá 10 MB.';

/**
 * Báo riêng "quá nặng" và "sai định dạng": gộp thành một câu là để người dùng
 * đi sửa sai chỗ — một tấm PNG đúng định dạng nhưng nặng 15 MB thì không có
 * thông báo nào chỉ đúng vấn đề.
 */
function rejectImage(file: File): string | null {
  if (file.size > MAX_BYTES) return SIZE_MESSAGE;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = file.type.toLowerCase();
  // Thiếu MIME type thì tin vào đuôi file; một số trình duyệt bỏ trống.
  const accepted = EXTENSIONS.includes(extension) && (!mime || MIME_TYPES.includes(mime));

  return accepted ? null : FORMAT_MESSAGE;
}

export function validateChapterImage(file: File): string | null {
  return rejectImage(file);
}

/**
 * Đuôi file chuẩn cho một MIME type ảnh, `null` nếu kiểu đó không nhận.
 *
 * Ảnh lấy từ clipboard hay từ trong file .docx đều đến dưới dạng bytes trần,
 * không có tên; phải tự đặt tên đúng đuôi thì mới qua được `validateChapterImage`.
 */
export function imageExtensionForMime(mime: string): string | null {
  const index = MIME_TYPES.indexOf(mime.toLowerCase());
  return index < 0 ? null : MIME_EXTENSIONS[index];
}

export function validateCoverImage(file: File): string | null {
  const message = rejectImage(file);
  return message === FORMAT_MESSAGE ? `Ảnh bìa: ${message.toLowerCase()}` : message;
}
