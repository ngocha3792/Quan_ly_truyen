import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { validateChapterImage } from '../domain/chapter-image-validation';
import {
  ChapterImportParseResult,
  pairCreatedChapters,
  parseChaptersFromText,
  ParsedImportChapter,
  resolveImagePlaceholders,
} from '../domain/chapter-import';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { ChapterFileReaderService, ImportedDraftImage } from './chapter-file-reader.service';

/** Máy chủ chỉ nhận 50 chương mỗi lần, nên bản thảo dài được chia thành từng lô. */
const BATCH_SIZE = 50;

/** Không ảnh nào tải lên được thì nội dung tạo ra không còn tham chiếu ảnh. */
const NO_IMAGE_URLS: ReadonlyMap<number, string> = new Map();

@Injectable()
export class ChapterImportStore {
  private readonly reader = inject(ChapterFileReaderService);
  private readonly repository = inject(AuthorStoryManagementRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly fileName = signal<string | null>(null);
  readonly parsed = signal<ChapterImportParseResult | null>(null);
  readonly reading = signal(false);
  readonly importing = signal(false);
  /** Số chương đã tạo xong, để hiện tiến độ khi bản thảo chia nhiều lô. */
  readonly importedCount = signal(0);
  /** Ảnh đọc được từ file, chờ tải lên sau khi chương đã tạo. */
  readonly images = signal<readonly ImportedDraftImage[]>([]);
  readonly uploadedImageCount = signal(0);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly skipped = signal<readonly string[]>([]);
  /** Ảnh không dùng được, cả loại file sai lẫn loại tải lên thất bại. */
  readonly imageProblems = signal<readonly string[]>([]);

  /** Đọc và tách file, chưa gửi gì lên máy chủ. */
  async choose(file: File): Promise<void> {
    if (this.reading() || this.importing()) return;

    this.reading.set(true);
    this.reset();
    this.fileName.set(file.name);

    try {
      const content = await this.reader.read(file);
      const problems = [...content.rejectedImages];
      const usable: ImportedDraftImage[] = [];

      for (const image of content.images) {
        const invalid = validateChapterImage(image.file);
        if (invalid) problems.push(`${image.altText || image.file.name}: ${invalid}`);
        else usable.push(image);
      }

      this.images.set(usable);
      this.imageProblems.set(problems);
      this.parsed.set(parseChaptersFromText(content.text));
    } catch (error: unknown) {
      this.fileName.set(null);
      this.error.set(error instanceof Error ? error.message : getApiErrorMessage(error));
    } finally {
      this.reading.set(false);
    }
  }

  clear(): void {
    if (this.importing()) return;
    this.fileName.set(null);
    this.reset();
  }

  /**
   * Tạo các chương đã tách, rồi tải ảnh lên và vá lại nội dung.
   *
   * Chương được tạo với ảnh đã lược bỏ, ảnh chỉ vá vào sau khi tải lên xong.
   * Làm ngược lại — tạo kèm placeholder rồi mới thay — là mỗi lần tải lên hỏng
   * để lại một tấm ảnh vỡ nằm vĩnh viễn trong chương.
   *
   * Chạy tuần tự chứ không song song: mỗi chương khoá truyện một lần, nên hai
   * lô cùng lúc chỉ chờ nhau lâu hơn. Lô nào hỏng thì dừng ở đó và giữ lại
   * phần đã tạo — báo đúng số chương đã vào còn hơn giả vờ như chưa có gì.
   */
  async importAll(storyId: string): Promise<boolean> {
    const chapters = this.parsed()?.chapters ?? [];
    if (!chapters.length || this.importing()) return false;

    this.importing.set(true);
    this.importedCount.set(0);
    this.uploadedImageCount.set(0);
    this.error.set(null);
    this.success.set(null);
    this.skipped.set([]);
    const skippedLines: string[] = [];
    const imageProblems = [...this.imageProblems()];

    try {
      for (let start = 0; start < chapters.length; start += BATCH_SIZE) {
        const batch = chapters.slice(start, start + BATCH_SIZE);

        const result = await firstValueFrom(
          this.repository
            .importChapters(
              storyId,
              batch.map((chapter) => ({
                title: chapter.title,
                content: resolveImagePlaceholders(chapter.content, NO_IMAGE_URLS),
              })),
            )
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );

        this.importedCount.update((count) => count + result.created.length);
        skippedLines.push(
          ...result.skipped.map((chapter) => `${chapter.title}: ${chapter.message}`),
        );

        for (const pair of pairCreatedChapters(
          batch,
          result.created,
          result.skipped.map((entry) => entry.index),
        )) {
          imageProblems.push(...(await this.attachImages(storyId, pair.created, pair.parsed)));
        }
      }

      this.success.set(this.describeOutcome());
      this.skipped.set(skippedLines);
      this.imageProblems.set(imageProblems);
      return true;
    } catch (error: unknown) {
      this.skipped.set(skippedLines);
      this.imageProblems.set(imageProblems);
      this.error.set(
        `${getApiErrorMessage(error)} Đã tạo được ${this.importedCount()} chương trước khi dừng.`,
      );
      return false;
    } finally {
      this.importing.set(false);
    }
  }

  /**
   * Tải ảnh của một chương rồi vá URL thật vào nội dung.
   *
   * @returns Mô tả các ảnh không vào được chương này, để báo cho tác giả.
   */
  private async attachImages(
    storyId: string,
    created: { readonly id: string; readonly version: number },
    parsed: ParsedImportChapter,
  ): Promise<readonly string[]> {
    const wanted = this.images().filter((image) => parsed.imageIndexes.includes(image.index));
    if (!wanted.length) return [];

    const urls = new Map<number, string>();
    const problems: string[] = [];

    for (const image of wanted) {
      try {
        const media = await firstValueFrom(
          this.repository
            .uploadChapterImage(created.id, image.file)
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );

        if (media.deliveryUrl) {
          urls.set(image.index, media.deliveryUrl);
          this.uploadedImageCount.update((count) => count + 1);
        } else {
          problems.push(`${parsed.title}: ảnh đã tải lên nhưng chưa có URL phân phối`);
        }
      } catch (error: unknown) {
        problems.push(`${parsed.title}: ${getApiErrorMessage(error)}`);
      }
    }

    if (urls.size) {
      try {
        await firstValueFrom(
          this.repository
            .updateChapter(storyId, created.id, {
              title: parsed.title,
              content: resolveImagePlaceholders(parsed.content, urls),
              expectedVersion: created.version,
            })
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );
      } catch (error: unknown) {
        /*
         * Ảnh đã lên CDN nhưng chương không nhận được URL. Chương vẫn đúng, chỉ
         * thiếu ảnh — báo ra để tác giả tự chèn lại, đừng im lặng.
         */
        problems.push(
          `${parsed.title}: chèn ảnh vào chương không thành công — ${getApiErrorMessage(error)}`,
        );
      }
    }

    return problems;
  }

  private describeOutcome(): string {
    const images = this.uploadedImageCount();
    const chapters = `Đã tạo ${this.importedCount()} chương nháp`;
    return images ? `${chapters}, kèm ${images} ảnh.` : `${chapters}.`;
  }

  private reset(): void {
    this.parsed.set(null);
    this.importedCount.set(0);
    this.uploadedImageCount.set(0);
    this.images.set([]);
    this.imageProblems.set([]);
    this.error.set(null);
    this.success.set(null);
    this.skipped.set([]);
  }
}
