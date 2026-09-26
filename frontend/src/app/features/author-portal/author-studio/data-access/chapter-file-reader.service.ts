import { Injectable } from '@angular/core';

/** Đuôi file bộ đọc nhận, để gắn vào thuộc tính `accept` của ô chọn file. */
export const CHAPTER_IMPORT_ACCEPT = '.txt,.md,.docx';

/** Trần kích thước file, chặn trước khi đọc cả file vào bộ nhớ trình duyệt. */
export const CHAPTER_IMPORT_MAX_BYTES = 20 * 1024 * 1024;

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

@Injectable({ providedIn: 'root' })
export class ChapterFileReaderService {
  /**
   * Đọc bản thảo thành chữ thuần.
   *
   * File nằm sẵn ở máy tác giả nên đọc luôn ở trình duyệt, không đẩy byte lên
   * máy chủ: repo không có hạ tầng multipart nào, và bản thảo chưa đăng thì
   * không có lý do gì phải nằm trên đĩa máy chủ.
   */
  async readAsText(file: File): Promise<string> {
    if (file.size > CHAPTER_IMPORT_MAX_BYTES) throw new ChapterFileTooLargeError();

    const name = file.name.toLowerCase();

    if (name.endsWith('.txt') || name.endsWith('.md')) return file.text();

    if (name.endsWith('.docx')) return this.readDocx(file);

    throw new UnsupportedChapterFileError(file.name);
  }

  /**
   * Bộ đọc .docx nạp động.
   *
   * mammoth nặng vài trăm KB mà phần lớn tác giả không bao giờ nhập file Word,
   * nên để nó ở chunk riêng thay vì cộng vào bundle ai cũng phải tải.
   */
  private async readDocx(file: File): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });

    return result.value;
  }
}
