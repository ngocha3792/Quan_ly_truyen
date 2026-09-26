/**
 * Đọc ảnh từ clipboard để dán thẳng vào trình soạn thảo.
 *
 * Ảnh chụp màn hình dán vào không giống ảnh chọn từ ổ đĩa: Snipping Tool và
 * các công cụ tương tự đưa vào một blob có tên tạm, hoặc không tên. Trong khi
 * đó `validateChapterImage` đòi đuôi file hợp lệ, nên blob không tên sẽ bị từ
 * chối dù nội dung hoàn toàn dùng được. Chỗ này chuẩn hoá lại trước khi giao
 * cho phần kiểm tra chung.
 */

/** Kiểu ảnh dán được, ánh xạ sang đuôi file chuẩn của hệ thống. */
const PASTEABLE_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const SUPPORTED_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'webp'];

/** Tiền tố tên do chính hệ thống đặt cho ảnh dán vào. */
const PASTED_NAME_PREFIX = 'anh-dan-';

export const UNSUPPORTED_PASTED_IMAGE_MESSAGE =
  'Ảnh dán vào không phải JPG, PNG hay WebP. Hãy lưu thành file rồi chọn từ máy.';

export interface PastedImageResult {
  /** Ảnh đã chuẩn hoá tên, sẵn sàng đi tiếp qua bước kiểm tra chung. */
  readonly files: readonly File[];

  /**
   * Clipboard có mang theo ảnh hay không.
   *
   * Nơi gọi dựa vào cờ này để quyết định có chặn hành vi dán mặc định. Dán
   * chữ thì phải để nguyên cho trình duyệt xử lý, không được nuốt mất.
   */
  readonly carriedImage: boolean;

  /** Có ảnh nhưng không dùng được — ví dụ ảnh TIFF từ máy Mac. */
  readonly error: string | null;
}

const EMPTY_RESULT: PastedImageResult = {
  files: [],
  carriedImage: false,
  error: null,
};

/**
 * @param files Nội dung `clipboardData.files` của sự kiện dán.
 * @param pastedAt Thời điểm dán, dùng đặt tên ảnh không tên.
 */
export function readPastedImages(files: readonly File[], pastedAt: Date): PastedImageResult {
  const images = files.filter((file) => isImage(file));

  if (images.length === 0) {
    return EMPTY_RESULT;
  }

  const normalised: File[] = [];
  let error: string | null = null;

  images.forEach((image, index) => {
    const renamed = renameForUpload(image, pastedAt, index);

    if (renamed) {
      normalised.push(renamed);
    } else {
      error = UNSUPPORTED_PASTED_IMAGE_MESSAGE;
    }
  });

  return { files: normalised, carriedImage: true, error };
}

/**
 * Nhận diện ảnh qua MIME type, kể cả kiểu không dán được.
 *
 * Phải bắt cả kiểu không hỗ trợ thì mới báo được cho người dùng biết vì sao
 * không dán được; bỏ qua im lặng là để họ bấm Ctrl+V mãi mà không hiểu.
 */
function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Giữ nguyên tên nếu nó vốn đã hợp lệ (ảnh copy từ File Explorer), còn lại thì
 * đặt tên mới theo MIME type. Trả về `null` nếu kiểu ảnh không dán được.
 */
function renameForUpload(file: File, pastedAt: Date, index: number): File | null {
  const extension = PASTEABLE_EXTENSION_BY_MIME[file.type.toLowerCase()];

  if (!extension) {
    return null;
  }

  if (hasSupportedExtension(file.name)) {
    return file;
  }

  const suffix = index === 0 ? '' : `-${index + 1}`;
  const name = `${PASTED_NAME_PREFIX}${formatStamp(pastedAt)}${suffix}.${extension}`;

  return new File([file], name, { type: file.type, lastModified: file.lastModified });
}

function hasSupportedExtension(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return name.includes('.') && SUPPORTED_EXTENSIONS.includes(extension);
}

/** `20260926-043012`, sắp xếp được và đọc được. */
function formatStamp(value: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  return (
    `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}` +
    `-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`
  );
}

/**
 * Người dùng đang gõ chữ ở đâu đó chứ không định dán ảnh vào khung ảnh.
 *
 * Trình nghe dán đặt ở mức `document` để bấm Ctrl+V chỗ nào trên trang cũng
 * ăn — nhưng đúng vì thế nên nó phải tự tránh khi con trỏ đang nằm trong ô
 * nhập liệu hoặc vùng soạn thảo, nếu không thao tác dán chữ bình thường sẽ bị
 * nuốt mất.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  /*
   * `closest` chứ không phải `isContentEditable`: con trỏ thường nằm trong một
   * thẻ con của vùng soạn thảo (đoạn văn, thẻ in đậm), nên phải dò ngược lên
   * cây. Đây cũng là cách duy nhất kiểm chứng được — jsdom không cài đặt
   * `isContentEditable` và luôn trả về false.
   */
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

/**
 * Chú thích ảnh minh họa suy ra từ tên file.
 *
 * Tên do hệ thống tự đặt cho ảnh dán vào chỉ là dấu thời gian, đọc lên chẳng
 * nói được gì — dùng làm alt là phá trải nghiệm của người dùng trình đọc màn
 * hình. Chỉ tên do người đặt mới đáng giữ.
 */
export function illustrationAlt(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return !base || base.startsWith(PASTED_NAME_PREFIX) ? 'Ảnh minh họa' : base;
}
