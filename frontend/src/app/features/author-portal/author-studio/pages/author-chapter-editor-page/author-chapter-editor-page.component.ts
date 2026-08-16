import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
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
}
