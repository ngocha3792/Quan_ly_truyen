import { readFile } from 'node:fs/promises';

import { parseChaptersFromText } from '../domain/chapter-import';
import {
  ChapterFileReaderService,
  ChapterFileTooLargeError,
  UnsupportedChapterFileError,
} from './chapter-file-reader.service';

/**
 * Chạy mammoth thật trên một file .docx thật.
 *
 * Mock mammoth ở đây là vô nghĩa: thứ duy nhất đáng kiểm là nó có đưa ảnh qua
 * `convertImage` hay không, và HTML nó sinh ra có phẳng hoá đúng thành dòng
 * "Chương 1: ..." mà bộ tách chương đọc được hay không.
 */
const FIXTURE = 'e2e/fixtures/ban-thao-co-anh.docx';

describe('ChapterFileReaderService', () => {
  let service: ChapterFileReaderService;

  beforeEach(() => {
    service = new ChapterFileReaderService();
  });

  async function docxFixture(name = 'ban-thao.docx'): Promise<File> {
    const bytes = await readFile(FIXTURE);
    return new File([new Uint8Array(bytes)], name, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  it('đọc chữ thuần từ .txt và .md, không có ảnh', async () => {
    const file = new File(['Chương 1: Một\nNội dung.'], 'ban-thao.txt', { type: 'text/plain' });

    const result = await service.read(file);

    expect(result.text).toBe('Chương 1: Một\nNội dung.');
    expect(result.images).toEqual([]);
    expect(result.rejectedImages).toEqual([]);
  });

  it('từ chối đuôi file không nhận', async () => {
    const file = new File(['x'], 'ban-thao.pdf', { type: 'application/pdf' });

    await expect(service.read(file)).rejects.toBeInstanceOf(UnsupportedChapterFileError);
  });

  it('chặn file quá lớn trước khi đọc vào bộ nhớ', async () => {
    const file = new File(['x'], 'ban-thao.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });

    await expect(service.read(file)).rejects.toBeInstanceOf(ChapterFileTooLargeError);
  });

  it('lấy được ảnh nhúng trong .docx kèm alt text', async () => {
    const result = await service.read(await docxFixture());

    expect(result.images).toHaveLength(2);
    expect(result.images.map((image) => image.altText)).toEqual(['Cảnh mưa', 'Chân dung']);
    expect(result.rejectedImages).toEqual([]);
  });

  it('đặt tên và MIME type cho ảnh để qua được bước kiểm tra chung', async () => {
    const result = await service.read(await docxFixture());

    for (const image of result.images) {
      // Không có đuôi file thì validateChapterImage loại ngay.
      expect(image.file.name).toMatch(/^anh-nhap-\d+\.png$/);
      expect(image.file.type).toBe('image/png');
      expect(image.file.size).toBeGreaterThan(0);
    }
  });

  it('giữ dòng tiêu đề chương ở dạng chữ thuần để bộ tách vẫn nhận ra', async () => {
    const result = await service.read(await docxFixture());

    // Thêm '##' vào đầu dòng là bộ tách chương không còn nhận ra tiêu đề nữa.
    expect(result.text).toContain('Chương 1: Khởi đầu');
    expect(result.text).not.toContain('#');
  });

  it('ảnh nằm đúng chương của nó sau khi tách', async () => {
    const result = await service.read(await docxFixture());
    const parsed = parseChaptersFromText(result.text);

    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(['Khởi đầu', 'Gặp gỡ']);
    // Đây là điều kiện để "chương nháp tạo ra có đúng ảnh đó".
    expect(parsed.chapters.map((chapter) => chapter.imageIndexes)).toEqual([[0], [1]]);
  });

  it('đặt ảnh đúng vị trí giữa các đoạn, không dồn xuống cuối chương', async () => {
    const result = await service.read(await docxFixture());
    const parsed = parseChaptersFromText(result.text);

    const first = parsed.chapters[0].content.split('\n').filter((line) => line.trim());
    expect(first[0]).toBe('Trời đổ mưa suốt đêm.');
    expect(first[1]).toMatch(/^!\[Cảnh mưa\]\(qlt-anh-nhap-0\)$/);
    expect(first[2]).toBe('Hắn bước ra khỏi cửa.');
  });

  it('không bỏ sót đoạn nào của bản thảo', async () => {
    const result = await service.read(await docxFixture());

    for (const paragraph of [
      'Trời đổ mưa suốt đêm.',
      'Hắn bước ra khỏi cửa.',
      'Chương 2: Gặp gỡ',
      'Nàng đứng đó, không nói gì.',
    ]) {
      expect(result.text).toContain(paragraph);
    }
  });
});
