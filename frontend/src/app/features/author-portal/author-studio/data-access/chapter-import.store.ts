import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterImportParseResult, parseChaptersFromText } from '../domain/chapter-import';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { ChapterFileReaderService } from './chapter-file-reader.service';

/** Máy chủ chỉ nhận 50 chương mỗi lần, nên bản thảo dài được chia thành từng lô. */
const BATCH_SIZE = 50;

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
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly skipped = signal<readonly string[]>([]);

  /** Đọc và tách file, chưa gửi gì lên máy chủ. */
  async choose(file: File): Promise<void> {
    if (this.reading() || this.importing()) return;

    this.reading.set(true);
    this.reset();
    this.fileName.set(file.name);

    try {
      this.parsed.set(parseChaptersFromText(await this.reader.readAsText(file)));
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
   * Tạo các chương đã tách, chia thành từng lô theo trần của máy chủ.
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
    this.error.set(null);
    this.success.set(null);
    this.skipped.set([]);
    const skippedLines: string[] = [];

    try {
      for (let start = 0; start < chapters.length; start += BATCH_SIZE) {
        const batch = chapters
          .slice(start, start + BATCH_SIZE)
          .map((chapter) => ({ title: chapter.title, content: chapter.content }));

        const result = await firstValueFrom(
          this.repository.importChapters(storyId, batch).pipe(takeUntilDestroyed(this.destroyRef)),
        );

        this.importedCount.update((count) => count + result.created.length);
        skippedLines.push(
          ...result.skipped.map((chapter) => `${chapter.title}: ${chapter.message}`),
        );
      }

      this.success.set(`Đã tạo ${this.importedCount()} chương nháp.`);
      this.skipped.set(skippedLines);
      return true;
    } catch (error: unknown) {
      this.skipped.set(skippedLines);
      this.error.set(
        `${getApiErrorMessage(error)} Đã tạo được ${this.importedCount()} chương trước khi dừng.`,
      );
      return false;
    } finally {
      this.importing.set(false);
    }
  }

  private reset(): void {
    this.parsed.set(null);
    this.importedCount.set(0);
    this.error.set(null);
    this.success.set(null);
    this.skipped.set([]);
  }
}
