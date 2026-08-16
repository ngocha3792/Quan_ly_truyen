import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthorStoryEditorStore } from '../../data-access/author-story-editor.store';
import {
  AuthorManagedStory,
  AuthorStoryCategory,
  AuthorStoryDraftInput,
  AuthorStoryTag,
} from '../../domain/author-story-management.models';

@Component({
  selector: 'app-author-story-editor-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  providers: [AuthorStoryEditorStore],
  templateUrl: './author-story-editor-page.component.html',
  styleUrl: './author-story-editor-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorStoryEditorPageComponent implements OnInit, OnDestroy {
  protected readonly store = inject(AuthorStoryEditorStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private storyId: string | null = this.route.snapshot.paramMap.get('storyId');
  private previewObjectUrl: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    synopsis: [''],
  });
  protected readonly selectedCategoryIds = signal<readonly string[]>([]);
  protected readonly selectedTagIds = signal<readonly string[]>([]);
  protected readonly coverFile = signal<File | null>(null);
  protected readonly coverPreviewUrl = signal<string | null>(null);
  protected readonly clearCover = signal(false);
  protected readonly authorNote = signal('');
  protected readonly fileError = signal<string | null>(null);
  protected readonly isCreate = computed(() => this.storyId === null);
  protected readonly isEditable = computed(() => {
    const story = this.store.story();
    return !story || story.status === 'DRAFT' || story.status === 'REJECTED';
  });
  protected readonly canSubmit = computed(() => {
    const status = this.store.story()?.status;
    return status === 'DRAFT' || status === 'REJECTED';
  });
  protected readonly canCancel = computed(() => this.store.story()?.status === 'PENDING_REVIEW');
  protected readonly displayedCoverUrl = computed(
    () => this.coverPreviewUrl() ?? (this.clearCover() ? null : this.store.coverUrl()),
  );
  protected readonly legacySelectedCategories = computed(() => {
    const story = this.store.story();
    if (!story) return [] as readonly AuthorStoryCategory[];
    const activeIds = new Set(this.store.categories().map((category) => category.id));
    const selectedIds = new Set(this.selectedCategoryIds());
    return story.categories.filter(
      (category) => !activeIds.has(category.id) && selectedIds.has(category.id),
    );
  });

  constructor() {
    effect(() => {
      const story = this.store.story();
      if (!story) return;

      this.form.patchValue({ title: story.title, synopsis: story.synopsis }, { emitEvent: false });
      this.selectedCategoryIds.set(
        story.categories.map((category: AuthorStoryCategory) => category.id),
      );
      this.selectedTagIds.set(story.tags.map((tag: AuthorStoryTag) => tag.id));
      if (this.isEditable()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
      this.form.markAsPristine();
    });
  }

  ngOnInit(): void {
    this.store.load(this.storyId);
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  protected toggleCategory(categoryId: string): void {
    if (!this.isEditable()) return;
    this.selectedCategoryIds.update((ids: readonly string[]) => toggleId(ids, categoryId));
    this.form.markAsDirty();
  }

  protected removeLegacyCategory(categoryId: string): void {
    if (!this.isEditable()) return;
    this.selectedCategoryIds.update((ids) => ids.filter((id) => id !== categoryId));
    this.form.markAsDirty();
  }

  protected toggleTag(tagId: string): void {
    if (!this.isEditable()) return;
    this.selectedTagIds.update((ids: readonly string[]) => toggleId(ids, tagId));
    this.form.markAsDirty();
  }

  protected isCategorySelected(categoryId: string): boolean {
    return this.selectedCategoryIds().includes(categoryId);
  }

  protected isTagSelected(tagId: string): boolean {
    return this.selectedTagIds().includes(tagId);
  }

  protected selectCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    const message = validateCover(file);
    if (message) {
      this.fileError.set(message);
      return;
    }

    this.fileError.set(null);
    this.clearCover.set(false);
    this.coverFile.set(file);
    this.revokePreview();
    this.previewObjectUrl = URL.createObjectURL(file);
    this.coverPreviewUrl.set(this.previewObjectUrl);
    this.form.markAsDirty();
  }

  protected removeCover(): void {
    if (!this.isEditable()) return;
    this.coverFile.set(null);
    this.clearCover.set(true);
    this.revokePreview();
    this.coverPreviewUrl.set(null);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (!this.isEditable() || this.form.invalid || this.store.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const input = this.buildInput();
    this.store
      .save(this.storyId, input, this.coverFile(), this.clearCover())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (story: AuthorManagedStory) => {
          this.resetPendingCover();
          this.form.markAsPristine();
          if (!this.storyId) {
            this.storyId = story.id;
            void this.router.navigate(['/author-studio/truyen', story.id]);
          }
        },
        error: () => undefined,
      });
  }

  protected submitForReview(): void {
    if (!this.storyId || !this.canSubmit() || this.hasUnsavedChanges()) return;

    this.store
      .submit(this.storyId, this.authorNote())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.authorNote.set(''), error: () => undefined });
  }

  protected cancelReview(): void {
    if (!this.storyId || !this.canCancel()) return;
    if (!window.confirm('Hủy yêu cầu duyệt để chỉnh sửa truyện?')) return;

    this.store
      .cancelSubmission(this.storyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  protected updateAuthorNote(event: Event): void {
    this.authorNote.set((event.target as HTMLTextAreaElement).value);
  }

  protected hasUnsavedChanges(): boolean {
    return this.form.dirty || this.coverFile() !== null || this.clearCover();
  }

  protected statusLabel(story: AuthorManagedStory): string {
    return story.status.replaceAll('_', ' ');
  }

  private buildInput(): AuthorStoryDraftInput {
    const value = this.form.getRawValue();
    return {
      title: value.title.trim(),
      synopsis: value.synopsis.trim(),
      categoryIds: this.selectedCategoryIds(),
      tagIds: this.selectedTagIds(),
    };
  }

  private resetPendingCover(): void {
    this.coverFile.set(null);
    this.clearCover.set(false);
    this.revokePreview();
    this.coverPreviewUrl.set(null);
  }

  private revokePreview(): void {
    if (!this.previewObjectUrl) return;
    URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
  }
}

function toggleId(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function validateCover(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) return 'Ảnh bìa không được vượt quá 10 MB.';
  const mime = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeValid = !mime || ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
  const extensionValid = ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '');
  return mimeValid && extensionValid ? null : 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.';
}
