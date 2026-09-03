import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthorChapterEditorStore } from '../../data-access/author-chapter-editor.store';

@Component({
  selector: 'app-author-chapter-editor-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  providers: [AuthorChapterEditorStore],
  templateUrl: './author-chapter-editor-page.component.html',
  styleUrl: './author-chapter-editor-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorChapterEditorPageComponent implements OnInit {
  @ViewChild('contentArea') private contentArea?: ElementRef<HTMLTextAreaElement>;
  protected readonly store = inject(AuthorChapterEditorStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly storyId = this.route.snapshot.paramMap.get('storyId') ?? '';
  private readonly chapterId = this.route.snapshot.paramMap.get('chapterId');
  protected readonly isCreate = this.chapterId === null;
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: [''],
  });
  protected readonly isEditable = computed(() => {
    const story = this.store.story();
    const chapter = this.store.chapter();
    if (!story || story.status === 'PENDING_REVIEW') return false;
    return !chapter || chapter.status === 'DRAFT';
  });

  constructor() {
    effect(() => {
      const chapter = this.store.chapter();
      if (chapter) {
        this.form.patchValue(
          { title: chapter.title, content: chapter.content },
          { emitEvent: false },
        );
      }
      if (this.store.story() && !this.isEditable()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
      this.form.markAsPristine();
    });
  }

  ngOnInit(): void {
    this.store.load(this.storyId, this.chapterId);
  }

  protected save(): void {
    if (!this.isEditable() || this.form.invalid || this.store.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.store
      .save(this.storyId, this.chapterId, {
        title: value.title.trim(),
        content: value.content,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/author-studio/truyen', this.storyId, 'chuong']),
        error: (error: unknown) => this.store.setError(error),
      });
  }

  protected selectChapterImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !this.chapterId) return;

    const validationError = validateChapterImage(file);
    if (validationError) {
      this.store.setError(validationError);
      return;
    }

    const textarea = this.contentArea?.nativeElement;
    const insertionPoint = textarea?.selectionStart ?? this.form.controls.content.value.length;
    this.store
      .uploadImage(this.chapterId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (media) => {
          if (!media.deliveryUrl) {
            this.store.setError('Ảnh đã tải lên nhưng chưa có URL phân phối.');
            return;
          }
          const current = this.form.controls.content.value;
          const alt = file.name.replace(/\.[^.]+$/, '').trim() || 'Ảnh minh họa';
          const markdown = `\n![${alt}](${media.deliveryUrl})\n`;
          this.form.controls.content.setValue(
            current.slice(0, insertionPoint) + markdown + current.slice(insertionPoint),
          );
          this.form.controls.content.markAsDirty();
        },
        error: (error: unknown) => this.store.setError(error),
      });
  }
}

function validateChapterImage(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) return 'Ảnh minh họa không được vượt quá 10 MB.';
  const mime = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeValid = !mime || ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
  const extensionValid = ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '');
  return mimeValid && extensionValid ? null : 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.';
}
