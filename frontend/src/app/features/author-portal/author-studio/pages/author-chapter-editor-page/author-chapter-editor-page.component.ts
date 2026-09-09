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
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AuthorChapterEditorStore } from '../../data-access/author-chapter-editor.store';
import { ChapterLocalRecoveryService } from '../../data-access/chapter-local-recovery.service';
import { AiStoryProfileStore } from '../../chapter-translation/data-access/ai-story-profile.store';
import { ChapterTranslationStore } from '../../chapter-translation/data-access/chapter-translation.store';
import { provideChapterTranslation } from '../../chapter-translation/data-access/chapter-translation.providers';
import {
  TARGET_LANGUAGE_OPTIONS,
  UpdateAiStoryProfilePayload,
} from '../../chapter-translation/domain/chapter-translation.models';
import { ChapterTranslationPanelComponent } from '../../chapter-translation/ui/chapter-translation-panel/chapter-translation-panel.component';

@Component({
  selector: 'app-author-chapter-editor-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
    BreadcrumbComponent,
    PageHeadingComponent,
    IconComponent,
    ButtonComponent,
    LoadingStateComponent,
    NoticeComponent,
    ChapterTranslationPanelComponent,
  ],
  providers: [
    AuthorChapterEditorStore,
    provideChapterTranslation(),
    ChapterTranslationStore,
    AiStoryProfileStore,
    ChapterLocalRecoveryService,
  ],
  templateUrl: './author-chapter-editor-page.component.html',
  styleUrls: [
    './author-chapter-editor-page.component.scss',
    './author-chapter-editor-page.monetization.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorChapterEditorPageComponent implements OnInit {
  @ViewChild('contentArea') private contentArea?: ElementRef<HTMLTextAreaElement>;
  protected readonly store = inject(AuthorChapterEditorStore);
  protected readonly translationStore = inject(ChapterTranslationStore);
  protected readonly storyProfileStore = inject(AiStoryProfileStore);
  protected readonly targetLanguageOptions = TARGET_LANGUAGE_OPTIONS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recovery = inject(ChapterLocalRecoveryService);

  protected readonly storyId = this.route.snapshot.paramMap.get('storyId') ?? '';
  private readonly chapterId = this.route.snapshot.paramMap.get('chapterId');
  protected readonly isCreate = this.chapterId === null;
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: [''],
  });
  protected readonly pricingForm = this.fb.nonNullable.group({
    accessType: this.fb.nonNullable.control<'FREE' | 'PAID'>('FREE'),
    priceBandId: [''],
  });
  protected readonly breadcrumbs = computed(() => [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Truyện của tôi', route: '/author-studio/truyen' },
    {
      label: this.store.story()?.title ?? 'Quản lý chương',
      route: `/author-studio/truyen/${this.storyId}/chuong`,
    },
    { label: this.isCreate ? 'Viết chương mới' : 'Chỉnh sửa chương' },
  ]);
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

      const pricing = this.store.monetization();
      if (pricing) {
        this.pricingForm.setValue(
          {
            accessType: pricing.accessType,
            priceBandId: pricing.priceBandId ?? '',
          },
          { emitEvent: false },
        );
        this.pricingForm.markAsPristine();
      }
    });
    this.form.valueChanges
      .pipe(
        debounceTime(2500),
        map((value) => ({ title: value.title?.trim() ?? '', content: value.content ?? '' })),
        distinctUntilChanged(
          (left, right) => left.title === right.title && left.content === right.content,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((draft) => {
        if (!this.chapterId || !this.isEditable() || !this.form.dirty || this.store.saving())
          return;
        void this.recovery.save({ chapterId: this.chapterId, ...draft });
        const version = this.store.chapter()?.version;
        if (version)
          this.store
            .autosave(this.storyId, this.chapterId, { ...draft, expectedVersion: version })
            .subscribe();
      });
  }

  ngOnInit(): void {
    this.store.load(this.storyId, this.chapterId);
    if (this.chapterId) this.store.loadHistory(this.storyId, this.chapterId);
    this.storyProfileStore.load(this.storyId);
  }

  protected viewVersion(version: number): void {
    if (!this.chapterId) return;
    this.store.selectVersion(this.storyId, this.chapterId, version);
  }

  protected loadMoreVersions(): void {
    if (!this.chapterId) return;
    this.store.loadMoreHistory(this.storyId, this.chapterId);
  }

  protected restoreVersion(version: number): void {
    if (!this.chapterId || !this.isEditable() || this.store.restoringVersion() !== null) return;

    const unsavedWarning = this.form.dirty
      ? ' Các thay đổi chưa lưu trong trình soạn thảo sẽ bị thay thế.'
      : '';
    if (
      !window.confirm(
        `Khôi phục phiên bản ${version}? Hệ thống sẽ tạo một phiên bản mới; lịch sử cũ vẫn được giữ.${unsavedWarning}`,
      )
    ) {
      return;
    }

    this.store
      .restoreVersion(this.storyId, this.chapterId, version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (error: unknown) => this.store.setError(error) });
  }

  protected translateChapter(targetLanguageCode: string): void {
    if (!this.chapterId) return;
    this.translationStore.request(this.storyId, this.chapterId, targetLanguageCode);
  }

  protected refreshTranslation(targetLanguageCode: string): void {
    if (!this.chapterId) return;
    this.translationStore.refresh(this.storyId, this.chapterId, targetLanguageCode);
  }

  protected updateStoryAiProfile(payload: UpdateAiStoryProfilePayload): void {
    this.storyProfileStore.update(this.storyId, payload);
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
        next: () => {
          if (this.chapterId) void this.recovery.clear(this.chapterId);
          void this.router.navigate(['/author-studio/truyen', this.storyId, 'chuong']);
        },
        error: (error: unknown) => this.store.setError(error),
      });
  }

  protected saveMonetization(): void {
    if (!this.chapterId || this.store.monetizationSaving()) return;
    const value = this.pricingForm.getRawValue();
    if (value.accessType === 'PAID' && !value.priceBandId) {
      this.store.setError('Hãy chọn một mức giá Credit.');
      return;
    }
    this.store
      .updateMonetization(
        this.storyId,
        this.chapterId,
        value.accessType,
        value.accessType === 'PAID' ? value.priceBandId : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (error: unknown) => this.store.setError(error) });
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
