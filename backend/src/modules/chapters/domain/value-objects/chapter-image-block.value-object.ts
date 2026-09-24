import type { ChapterContentBlock } from './chapter-content-document.value-object';

/**
 * Ảnh trong nội dung chương được lưu nguyên dạng Markdown trong text của block
 * (schema v1 không có block type riêng cho ảnh). Reader cần biết đâu là ảnh để
 * render thẻ img thay vì in chuỗi URL ra màn hình, nên chỗ này nhận diện lúc
 * dựng response đọc chương thay vì đổi schema lưu trữ.
 */
export interface ChapterImageBlockContent {
  readonly url: string;
  readonly alt: string;
}

/** `![alt](https://... "title")` — tiêu đề tùy chọn và bị bỏ qua. */
const MARKDOWN_IMAGE =
  /^!\[(?<alt>[^\]]*)\]\([\t ]*<?(?<url>[^\s<>()]+)>?(?:[\t ]+["'(][^\n]*["')])?[\t ]*\)$/u;

/** URL trần đứng một mình, chỉ coi là ảnh khi đuôi file là ảnh. */
const BARE_IMAGE_URL =
  /^(?<url>\S+\.(?:apng|avif|gif|jpe?g|png|svg|webp)(?:\?\S*)?)$/iu;

/**
 * Chỉ chấp nhận http/https. Chặn javascript:, data:, vbscript: và mọi scheme
 * khác để URL do tác giả nhập không trở thành vector chèn mã ở client.
 */
function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Trả về nội dung ảnh khi cả block chỉ chứa đúng một ảnh. Block vừa có chữ vừa
 * có ảnh vẫn là paragraph — reader in chữ như cũ, không đoán thêm.
 */
export function resolveChapterImageBlock(
  text: string,
): ChapterImageBlockContent | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes('\n')) return null;

  const markdown = MARKDOWN_IMAGE.exec(trimmed);
  if (markdown?.groups) {
    const url = markdown.groups['url'] ?? '';
    return isSafeImageUrl(url)
      ? { url, alt: (markdown.groups['alt'] ?? '').trim() }
      : null;
  }

  const bare = BARE_IMAGE_URL.exec(trimmed);
  if (bare?.groups) {
    const url = bare.groups['url'] ?? '';
    return isSafeImageUrl(url) ? { url, alt: '' } : null;
  }

  return null;
}

/** True khi block chỉ là ảnh — dùng để bỏ qua block khi đọc thành tiếng. */
export function isChapterImageBlock(
  block: Pick<ChapterContentBlock, 'type' | 'text'>,
): boolean {
  return (
    block.type === 'paragraph' && resolveChapterImageBlock(block.text) !== null
  );
}

/** Tiền tố `#{1,6}` + khoảng trắng của một heading Markdown. */
const MARKDOWN_HEADING = /^(?<hashes>#{1,6})[\t ]+(?=\S)/u;

export interface ChapterHeadingBlockContent {
  /** 1-6 theo số dấu #. */
  readonly level: number;
  /**
   * Số ký tự tiền tố bị ẩn khi hiển thị. Neo bình luận được tính theo text
   * nguồn nên client phải cộng lại số này vào offset lấy từ DOM.
   */
  readonly textOffset: number;
}

/**
 * Chỉ xử lý heading một dòng — đúng dạng parser sinh ra. Blockquote, list và
 * code có ký hiệu lặp trên từng dòng nên một offset duy nhất không mô tả được,
 * vì vậy để nguyên.
 */
export function resolveChapterHeadingBlock(
  text: string,
): ChapterHeadingBlockContent | null {
  if (text.includes('\n')) return null;
  const match = MARKDOWN_HEADING.exec(text);
  if (!match?.groups) return null;
  return {
    level: (match.groups['hashes'] ?? '').length,
    textOffset: match[0].length,
  };
}
