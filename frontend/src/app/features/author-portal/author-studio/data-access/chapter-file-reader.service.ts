import { Injectable } from '@angular/core';

import { imageExtensionForMime } from '../domain/chapter-image-validation';
import { imagePlaceholder } from '../domain/chapter-import';

/** Đuôi file bộ đọc nhận, để gắn vào thuộc tính `accept` của ô chọn file. */
export const CHAPTER_IMPORT_ACCEPT = '.txt,.md,.docx';

/** Trần kích thước file, chặn trước khi đọc cả file vào bộ nhớ trình duyệt. */
export const CHAPTER_IMPORT_MAX_BYTES = 20 * 1024 * 1024;

/** Trần số ảnh đọc từ một bản thảo. */
export const CHAPTER_IMPORT_MAX_IMAGES = 200;

export class UnsupportedChapterFileError extends Error {
  constructor(name: string) {
    super(`Không đọc được "${name}". Chỉ nhận file .txt, .md hoặc .docx.`);
  }
}

export class ChapterFileTooLargeError extends Error {
  constructor() {
    super('File quá lớn. Hãy cắt bản thảo thành nhiều file nhỏ hơn 20MB.');
  }
}

export class TooManyChapterImagesError extends Error {
  constructor() {
    super(
      `Bản thảo có hơn ${CHAPTER_IMPORT_MAX_IMAGES} ảnh. ` +
        'Hãy cắt thành nhiều file nhỏ hơn rồi nhập lần lượt.',
    );
  }
}

/** Một ảnh đọc được từ bản thảo, đã sẵn sàng tải lên. */
export interface ImportedDraftImage {
  /** Khớp với placeholder trong nội dung chương. */
  readonly index: number;
  readonly file: File;
  readonly altText: string;
}

export interface ChapterDraftFileContent {
  readonly text: string;
  readonly images: readonly ImportedDraftImage[];
  /**
   * Ảnh có trong file nhưng không dùng được, kèm lý do.
   *
   * Word nhúng biểu đồ và hình vẽ dưới dạng EMF/WMF; bỏ qua im lặng là để tác
   * giả tưởng ảnh đã vào rồi.
   */
  readonly rejectedImages: readonly string[];
}

/** Thẻ khối, mỗi thẻ thành một dòng riêng trong bản thảo. */
const BLOCK_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'DIV',
  'TR',
]);

@Injectable({ providedIn: 'root' })
export class ChapterFileReaderService {
  /**
   * Đọc bản thảo thành chữ, kèm ảnh nếu file có.
   *
   * File nằm sẵn ở máy tác giả nên đọc luôn ở trình duyệt, không đẩy byte lên
   * máy chủ: repo không có hạ tầng multipart nào, và bản thảo chưa đăng thì
   * không có lý do gì phải nằm trên đĩa máy chủ.
   */
  async read(file: File): Promise<ChapterDraftFileContent> {
    if (file.size > CHAPTER_IMPORT_MAX_BYTES) throw new ChapterFileTooLargeError();

    const name = file.name.toLowerCase();

    if (name.endsWith('.txt') || name.endsWith('.md')) {
      return { text: await file.text(), images: [], rejectedImages: [] };
    }

    if (name.endsWith('.docx')) return this.readDocx(file);

    throw new UnsupportedChapterFileError(file.name);
  }

  /**
   * Bộ đọc .docx nạp động.
   *
   * mammoth nặng vài trăm KB mà phần lớn tác giả không bao giờ nhập file Word,
   * nên để nó ở chunk riêng thay vì cộng vào bundle ai cũng phải tải.
   *
   * Dùng `convertToHtml` chứ không phải `extractRawText`: chỉ bản HTML mới đi
   * qua `convertImage`, còn `extractRawText` bỏ ảnh không một lời nào.
   */
  private async readDocx(file: File): Promise<ChapterDraftFileContent> {
    const mammoth = await import('mammoth');
    const images: ImportedDraftImage[] = [];
    const rejectedImages: string[] = [];

    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        convertImage: mammoth.images.imgElement(async (element) => {
          const altText = readAltText(element);
          const extension = imageExtensionForMime(element.contentType);

          if (!extension) {
            rejectedImages.push(
              `${altText || 'Ảnh không tên'} (${element.contentType}) không phải JPG, PNG hay WebP`,
            );
            /*
             * `src` rỗng chứ không phải bỏ trống: mammoth khai báo `src` là bắt
             * buộc. Bước phẳng hoá bên dưới coi src rỗng là ảnh bị loại.
             */
            return { src: '' };
          }

          if (images.length >= CHAPTER_IMPORT_MAX_IMAGES) throw new TooManyChapterImagesError();

          const index = images.length;
          images.push({
            index,
            altText,
            file: new File(
              [await element.readAsArrayBuffer()],
              `anh-nhap-${index + 1}.${extension}`,
              { type: element.contentType },
            ),
          });

          return { src: imagePlaceholder(index) };
        }),
      },
    );

    return { text: flattenHtmlToDraftText(result.value), images, rejectedImages };
  }
}

/**
 * Alt text của ảnh trong file Word.
 *
 * mammoth đọc `altText` lúc chạy nhưng không khai báo nó trong file typings đi
 * kèm, nên phải tự thu hẹp kiểu thay vì ép bằng `as`.
 */
function readAltText(element: unknown): string {
  if (typeof element !== 'object' || element === null || !('altText' in element)) return '';

  const value = (element as { readonly altText?: unknown }).altText;
  return typeof value === 'string' ? value : '';
}

/**
 * Chuyển HTML của mammoth về đúng hình dạng mà bộ tách chương đang đọc: mỗi
 * đoạn một dòng, các đoạn cách nhau một dòng trống.
 *
 * Cố tình KHÔNG sinh markdown cho tiêu đề hay chữ in đậm. Bộ tách chương tìm
 * dòng bắt đầu bằng "Chương 12:"; thêm `##` vào đầu dòng là nó không nhận ra
 * nữa. Ảnh là ngoại lệ duy nhất, vì ảnh không có cách nào khác để biểu diễn.
 */
function flattenHtmlToDraftText(html: string): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const lines: string[] = [];

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (!(child instanceof Element)) continue;

      if (child.tagName === 'IMG') continue;

      if (BLOCK_TAGS.has(child.tagName)) {
        const line = inlineText(child).trim();
        if (line) lines.push(line);
        // Đoạn lồng trong đoạn (danh sách, bảng) vẫn phải tách dòng tiếp.
        if (child.querySelector([...BLOCK_TAGS].join(','))) walk(child);
        continue;
      }

      walk(child);
    }
  };

  walk(body);

  return lines.join('\n\n');
}

/** Chữ của một khối, với ảnh thành cú pháp ảnh markdown. */
function inlineText(block: Element): string {
  const parts: string[] = [];

  for (const node of Array.from(block.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      continue;
    }

    if (!(node instanceof Element)) continue;

    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src');
      // Ảnh bị loại (không có src) thì bỏ qua, đừng sinh markdown rỗng.
      if (src) parts.push(`![${node.getAttribute('alt') ?? ''}](${src})`);
      continue;
    }

    if (BLOCK_TAGS.has(node.tagName)) continue;

    parts.push(inlineText(node));
  }

  return parts.join('');
}
