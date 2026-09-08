import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  OfflinePackageSummary,
  OfflineSourceChapter,
  OfflineSourceStory,
} from '../domain/offline-package.models';
import { OfflinePackagesRepository } from '../domain/offline-packages.repository';

const CHAPTER_PAGE_SIZE = 40;

@Injectable()
export class OfflinePackageCreateStore {
  private readonly repository = inject(OfflinePackagesRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly sourceStories = signal<readonly OfflineSourceStory[]>([]);
  readonly sourceLoading = signal(false);
  readonly open = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly storyQuery = signal('');
  readonly selectedStoryId = signal<string | null>(null);
  readonly chapters = signal<readonly OfflineSourceChapter[]>([]);
  readonly chapterLoading = signal(false);
  readonly chapterError = signal<string | null>(null);
  readonly chapterPage = signal(1);
  readonly chapterTotalPages = signal(1);
  readonly selectedChapterIds = signal<readonly string[]>([]);
  readonly packageName = signal('');
  readonly packageDescription = signal('');
  readonly maxChapters = signal(50);

  readonly filteredStories = computed(() => {
    const query = this.storyQuery().trim().toLocaleLowerCase('vi');
    if (!query) return this.sourceStories();
    return this.sourceStories().filter((story) =>
      `${story.title} ${story.author}`.toLocaleLowerCase('vi').includes(query),
    );
  });

  private readonly selectedStory = computed(() => {
    const selectedId = this.selectedStoryId();
    return this.sourceStories().find((story) => story.id === selectedId) ?? null;
  });

  readonly canSubmit = computed(
    () =>
      Boolean(this.packageName().trim()) &&
      Boolean(this.selectedStoryId()) &&
      this.selectedChapterIds().length > 0 &&
      this.selectedChapterIds().length <= this.maxChapters(),
  );

  loadSources(): void {
    if (this.sourceLoading() || this.sourceStories().length > 0) return;
    this.sourceLoading.set(true);
    this.repository
      .listSourceStories()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.sourceLoading.set(false)),
      )
      .subscribe({
        next: (stories) => this.sourceStories.set(stories),
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải danh sách truyện.')),
      });
  }

  openDialog(maxChapters: number): void {
    this.reset();
    this.maxChapters.set(Math.max(1, maxChapters));
    this.open.set(true);
  }

  closeDialog(): void {
    if (!this.creating()) this.open.set(false);
  }

  setStoryQuery(query: string): void {
    this.storyQuery.set(query);
  }

  selectStory(storyId: string): void {
    if (storyId === this.selectedStoryId()) return;
    const story = this.sourceStories().find((item) => item.id === storyId);
    if (!story) return;
    this.selectedStoryId.set(storyId);
    this.selectedChapterIds.set([]);
    this.packageName.set(story.title);
    this.chapterPage.set(1);
    this.loadChapters(story.slug, 1);
  }

  toggleChapter(chapterId: string): void {
    this.selectedChapterIds.update((current) => {
      if (current.includes(chapterId)) return current.filter((id) => id !== chapterId);
      if (current.length >= this.maxChapters()) return current;
      return [...current, chapterId];
    });
  }

  selectCurrentPage(): void {
    this.selectedChapterIds.update((current) => {
      const selected = new Set(current);
      for (const chapter of this.chapters()) {
        if (selected.size >= this.maxChapters()) break;
        selected.add(chapter.id);
      }
      return [...selected];
    });
  }

  clearChapterSelection(): void {
    this.selectedChapterIds.set([]);
  }

  previousChapterPage(): void {
    this.goToChapterPage(this.chapterPage() - 1);
  }

  nextChapterPage(): void {
    this.goToChapterPage(this.chapterPage() + 1);
  }

  setPackageName(value: string): void {
    this.packageName.set(value);
  }

  setPackageDescription(value: string): void {
    this.packageDescription.set(value);
  }

  createPackage(onCreated: (created: OfflinePackageSummary) => void): void {
    if (!this.canSubmit() || this.creating()) return;
    this.creating.set(true);
    this.error.set(null);
    this.repository
      .createPackage({
        name: this.packageName().trim(),
        ...(this.packageDescription().trim()
          ? { description: this.packageDescription().trim() }
          : {}),
        chapterIds: this.selectedChapterIds(),
        idempotencyKey: crypto.randomUUID(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.creating.set(false)),
      )
      .subscribe({
        next: (created) => {
          this.open.set(false);
          onCreated(created);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tạo gói offline.')),
      });
  }

  clearError(): void {
    this.error.set(null);
  }

  private goToChapterPage(page: number): void {
    const story = this.selectedStory();
    if (!story || page < 1 || page > this.chapterTotalPages() || this.chapterLoading()) return;
    this.chapterPage.set(page);
    this.loadChapters(story.slug, page);
  }

  private loadChapters(storySlug: string, page: number): void {
    this.chapterLoading.set(true);
    this.chapterError.set(null);
    this.repository
      .listStoryChapters(storySlug, page, CHAPTER_PAGE_SIZE)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.chapterLoading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.chapters.set(result.items);
          this.chapterPage.set(result.page);
          this.chapterTotalPages.set(result.totalPages);
        },
        error: (error: unknown) => {
          this.chapters.set([]);
          this.chapterError.set(getApiErrorMessage(error, 'Không thể tải danh sách chương.'));
        },
      });
  }

  private reset(): void {
    this.error.set(null);
    this.storyQuery.set('');
    this.selectedStoryId.set(null);
    this.chapters.set([]);
    this.chapterError.set(null);
    this.chapterPage.set(1);
    this.chapterTotalPages.set(1);
    this.selectedChapterIds.set([]);
    this.packageName.set('');
    this.packageDescription.set('');
  }
}
