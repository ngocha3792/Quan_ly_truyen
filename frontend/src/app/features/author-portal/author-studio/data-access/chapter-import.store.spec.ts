import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { ChapterFileReaderService } from './chapter-file-reader.service';
import { ChapterImportStore } from './chapter-import.store';

const STORY_ID = 'story-1';

function draftFile(text: string): File {
  return new File([text], 'ban-thao.txt', { type: 'text/plain' });
}

describe('ChapterImportStore', () => {
  let store: ChapterImportStore;
  const reader = { read: vi.fn() };
  const repository = {
    importChapters: vi.fn(),
    uploadChapterImage: vi.fn(),
    updateChapter: vi.fn(),
  };

  /** Bộ đọc trả về chữ thuần, không ảnh. */
  function textOnly(text: string) {
    return { text, images: [], rejectedImages: [] };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ChapterImportStore,
        { provide: ChapterFileReaderService, useValue: reader },
        { provide: AuthorStoryManagementRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(ChapterImportStore);
  });

  it('đọc file rồi tách chương mà chưa gửi gì lên máy chủ', async () => {
    reader.read.mockResolvedValue(textOnly('Chương 1: Mở đầu\nNội dung.'));

    await store.choose(draftFile('bỏ qua, reader đã bị mock'));

    expect(store.parsed()?.chapters).toHaveLength(1);
    expect(store.fileName()).toBe('ban-thao.txt');
    // Xem trước là xem trước: không được tạo gì cho tới khi tác giả bấm xác nhận.
    expect(repository.importChapters).not.toHaveBeenCalled();
  });

  it('báo lỗi đọc file bằng đúng câu của bộ đọc', async () => {
    reader.read.mockRejectedValue(new Error('File quá lớn.'));

    await store.choose(draftFile('x'));

    expect(store.error()).toBe('File quá lớn.');
    expect(store.fileName()).toBeNull();
  });

  /*
   * Máy chủ chỉ nhận 50 chương mỗi lần. Bản thảo dài phải được chia lô, không
   * thì lô đầu đã bị từ chối và tác giả không nhập được gì.
   */
  it('chia bản thảo dài thành nhiều lô theo trần của máy chủ', async () => {
    const draft = Array.from(
      { length: 120 },
      (_, index) => `Chương ${index + 1}: Tên\nNội dung.`,
    ).join('\n');
    reader.read.mockResolvedValue(textOnly(draft));
    repository.importChapters.mockImplementation((_id: string, chapters: unknown[]) =>
      of({ created: chapters.map(() => ({ id: 'x', number: 1, version: 1 })), skipped: [] }),
    );

    await store.choose(draftFile('x'));
    expect(await store.importAll(STORY_ID)).toBe(true);

    expect(repository.importChapters).toHaveBeenCalledTimes(3);
    expect(
      (repository.importChapters.mock.calls as [string, unknown[]][]).map((call) => call[1].length),
    ).toEqual([50, 50, 20]);
    expect(store.importedCount()).toBe(120);
  });

  /*
   * Lô thứ hai hỏng không xoá được 50 chương lô đầu đã tạo. Nói đúng số đã vào
   * còn hơn để tác giả bấm lại và nhân đôi mọi thứ.
   */
  it('giữ và báo số chương đã tạo khi một lô giữa chừng hỏng', async () => {
    const draft = Array.from(
      { length: 60 },
      (_, index) => `Chương ${index + 1}: Tên\nNội dung.`,
    ).join('\n');
    reader.read.mockResolvedValue(textOnly(draft));
    repository.importChapters
      .mockReturnValueOnce(
        of({
          created: Array.from({ length: 50 }, () => ({ id: 'x', number: 1, version: 1 })),
          skipped: [],
        }),
      )
      .mockReturnValueOnce(throwError(() => new Error('mạng hỏng')));

    await store.choose(draftFile('x'));
    expect(await store.importAll(STORY_ID)).toBe(false);

    expect(store.importedCount()).toBe(50);
    expect(store.error()).toContain('Đã tạo được 50 chương trước khi dừng');
  });

  it('không nhập khi file không tách được chương nào', async () => {
    reader.read.mockResolvedValue(textOnly('Chỉ là văn xuôi.'));

    await store.choose(draftFile('x'));
    expect(await store.importAll(STORY_ID)).toBe(false);

    expect(repository.importChapters).not.toHaveBeenCalled();
  });

  describe('ảnh trong bản thảo', () => {
    function image(index: number, altText: string) {
      return {
        index,
        altText,
        file: new File([new Uint8Array([1, 2, 3])], `anh-nhap-${index + 1}.png`, {
          type: 'image/png',
        }),
      };
    }

    /** Bản thảo hai chương, mỗi chương một ảnh, đúng hình dạng bộ đọc trả về. */
    function twoChaptersWithImages() {
      return {
        text: [
          'Chương 1: Một',
          'Trước ảnh.',
          '![Cảnh mưa](qlt-anh-nhap-0)',
          'Chương 2: Hai',
          '![Chân dung](qlt-anh-nhap-1)',
        ].join('\n'),
        images: [image(0, 'Cảnh mưa'), image(1, 'Chân dung')],
        rejectedImages: [],
      };
    }

    function createdChapters() {
      return of({
        created: [
          { id: 'chuong-1', number: 1, version: 1 },
          { id: 'chuong-2', number: 2, version: 1 },
        ],
        skipped: [],
      });
    }

    it('tạo chương với ảnh đã lược bỏ, không gửi placeholder lên máy chủ', async () => {
      reader.read.mockResolvedValue(twoChaptersWithImages());
      repository.importChapters.mockReturnValue(createdChapters());
      repository.uploadChapterImage.mockReturnValue(of({ deliveryUrl: 'https://cdn.test/a.webp' }));
      repository.updateChapter.mockReturnValue(of({}));

      await store.choose(draftFile('x'));
      expect(await store.importAll(STORY_ID)).toBe(true);

      /*
       * Gửi kèm placeholder rồi mới thay là mỗi lần tải lên hỏng để lại một tấm
       * ảnh vỡ nằm vĩnh viễn trong chương.
       */
      const sent = (
        repository.importChapters.mock.calls as [string, { content: string }[]][]
      )[0][1];
      expect(sent[0].content).not.toContain('qlt-anh-nhap');
      expect(sent[0].content).toBe('Trước ảnh.');
    });

    it('tải ảnh lên đúng chương của nó', async () => {
      reader.read.mockResolvedValue(twoChaptersWithImages());
      repository.importChapters.mockReturnValue(createdChapters());
      repository.uploadChapterImage.mockReturnValue(of({ deliveryUrl: 'https://cdn.test/a.webp' }));
      repository.updateChapter.mockReturnValue(of({}));

      await store.choose(draftFile('x'));
      await store.importAll(STORY_ID);

      // Đây là điều kiện "chương nháp tạo ra có đúng ảnh đó".
      const uploads = (repository.uploadChapterImage.mock.calls as [string, File][]).map(
        ([chapterId, file]) => [chapterId, file.name],
      );
      expect(uploads).toEqual([
        ['chuong-1', 'anh-nhap-1.png'],
        ['chuong-2', 'anh-nhap-2.png'],
      ]);
    });

    it('vá URL thật vào nội dung chương sau khi tải lên', async () => {
      reader.read.mockResolvedValue(twoChaptersWithImages());
      repository.importChapters.mockReturnValue(createdChapters());
      repository.uploadChapterImage.mockImplementation((chapterId: string) =>
        of({ deliveryUrl: `https://cdn.test/${chapterId}.webp` }),
      );
      repository.updateChapter.mockReturnValue(of({}));

      await store.choose(draftFile('x'));
      await store.importAll(STORY_ID);

      const patches = (
        repository.updateChapter.mock.calls as [
          string,
          string,
          { content: string; expectedVersion: number },
        ][]
      ).map(([, chapterId, input]) => [chapterId, input.content, input.expectedVersion]);

      expect(patches).toEqual([
        ['chuong-1', 'Trước ảnh.\n![Cảnh mưa](https://cdn.test/chuong-1.webp)', 1],
        ['chuong-2', '![Chân dung](https://cdn.test/chuong-2.webp)', 1],
      ]);
      expect(store.success()).toContain('2 ảnh');
    });

    it('không gọi vá nội dung cho chương không có ảnh', async () => {
      reader.read.mockResolvedValue(textOnly('Chương 1: Một\nChỉ có chữ.'));
      repository.importChapters.mockReturnValue(
        of({ created: [{ id: 'chuong-1', number: 1, version: 1 }], skipped: [] }),
      );

      await store.choose(draftFile('x'));
      await store.importAll(STORY_ID);

      expect(repository.uploadChapterImage).not.toHaveBeenCalled();
      expect(repository.updateChapter).not.toHaveBeenCalled();
    });

    it('giữ chương và báo rõ khi ảnh tải lên thất bại', async () => {
      reader.read.mockResolvedValue(twoChaptersWithImages());
      repository.importChapters.mockReturnValue(createdChapters());
      repository.uploadChapterImage
        .mockReturnValueOnce(throwError(() => new Error('Cloudinary chết')))
        .mockReturnValueOnce(of({ deliveryUrl: 'https://cdn.test/b.webp' }));
      repository.updateChapter.mockReturnValue(of({}));

      await store.choose(draftFile('x'));
      expect(await store.importAll(STORY_ID)).toBe(true);

      // Chương vẫn tạo, chỉ thiếu ảnh — và tác giả phải biết chương nào thiếu.
      expect(store.importedCount()).toBe(2);
      expect(store.imageProblems().join(' ')).toContain('Một');
      // Chương 1 không có ảnh nào thành công nên không cần vá.
      const patched = (repository.updateChapter.mock.calls as [string, string, unknown][]).map(
        ([, chapterId]) => chapterId,
      );
      expect(patched).toEqual(['chuong-2']);
    });

    it('báo khi ảnh lên được CDN nhưng chèn vào chương thất bại', async () => {
      reader.read.mockResolvedValue(twoChaptersWithImages());
      repository.importChapters.mockReturnValue(createdChapters());
      repository.uploadChapterImage.mockReturnValue(of({ deliveryUrl: 'https://cdn.test/a.webp' }));
      repository.updateChapter.mockReturnValue(throwError(() => new Error('xung đột phiên bản')));

      await store.choose(draftFile('x'));
      await store.importAll(STORY_ID);

      expect(store.imageProblems().join(' ')).toContain('chèn ảnh vào chương không thành công');
    });

    it('loại ảnh sai định dạng ngay khi đọc file, không đợi tới lúc tải lên', async () => {
      reader.read.mockResolvedValue({
        text: 'Chương 1: Một\n![Ảnh](qlt-anh-nhap-0)',
        images: [
          {
            index: 0,
            altText: 'Ảnh nặng',
            file: Object.defineProperty(
              new File([new Uint8Array([1])], 'to.png', { type: 'image/png' }),
              'size',
              { value: 11 * 1024 * 1024 },
            ),
          },
        ],
        rejectedImages: ['Biểu đồ (image/x-emf) không phải JPG, PNG hay WebP'],
      });
      repository.importChapters.mockReturnValue(
        of({ created: [{ id: 'chuong-1', number: 1, version: 1 }], skipped: [] }),
      );

      await store.choose(draftFile('x'));

      // Cả ảnh bị mammoth loại lẫn ảnh quá nặng đều phải hiện ra trước khi nhập.
      expect(store.imageProblems()).toHaveLength(2);
      expect(store.imageProblems().join(' ')).toContain('image/x-emf');
      expect(store.imageProblems().join(' ')).toContain('10 MB');

      await store.importAll(STORY_ID);
      expect(repository.uploadChapterImage).not.toHaveBeenCalled();
    });

    it('ghép ảnh đúng chương khi máy chủ bỏ một chương giữa lô', async () => {
      reader.read.mockResolvedValue({
        text: [
          'Chương 1: Một',
          '![A](qlt-anh-nhap-0)',
          'Chương 2: Hai',
          '![B](qlt-anh-nhap-1)',
          'Chương 3: Ba',
          '![C](qlt-anh-nhap-2)',
        ].join('\n'),
        images: [image(0, 'A'), image(1, 'B'), image(2, 'C')],
        rejectedImages: [],
      });
      // Chương giữa bị từ chối: ảnh C phải theo chương 3, không nhảy sang chương 2.
      repository.importChapters.mockReturnValue(
        of({
          created: [
            { id: 'chuong-1', number: 1, version: 1 },
            { id: 'chuong-3', number: 3, version: 1 },
          ],
          skipped: [{ index: 1, title: 'Hai', code: 'DUPLICATE', message: 'trùng tên' }],
        }),
      );
      repository.uploadChapterImage.mockReturnValue(of({ deliveryUrl: 'https://cdn.test/a.webp' }));
      repository.updateChapter.mockReturnValue(of({}));

      await store.choose(draftFile('x'));
      await store.importAll(STORY_ID);

      const uploads = (repository.uploadChapterImage.mock.calls as [string, File][]).map(
        ([chapterId, file]) => [chapterId, file.name],
      );
      expect(uploads).toEqual([
        ['chuong-1', 'anh-nhap-1.png'],
        ['chuong-3', 'anh-nhap-3.png'],
      ]);
    });
  });
});
