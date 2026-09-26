import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AuthorChapterEditorStore } from '../../data-access/author-chapter-editor.store';
import { ChapterRecoveryQueueService } from '../../data-access/chapter-recovery-queue.service';
import { ChapterLocalRecoveryService } from '../../data-access/chapter-local-recovery.service';
import { ChapterEditingSessionStore } from '../../data-access/chapter-editing-session.store';
import { ChapterWorkflowStore } from '../../data-access/chapter-workflow.store';
import { validateChapterImage } from '../../domain/chapter-image-validation';
import { illustrationAlt } from '../../domain/clipboard-image';
import { ChapterTranslationWorkspaceComponent } from '../../chapter-translation/pages/chapter-translation-workspace/chapter-translation-workspace.component';
import { AiAuthorToolsComponent } from '../../ai-tools/pages/ai-author-tools/ai-author-tools.component';
import { ChapterRichEditorComponent } from '../../ui/chapter-rich-editor/chapter-rich-editor.component';
import { MangaPageUploaderComponent } from '../../ui/manga-page-uploader/manga-page-uploader.component';
import { ChapterEditorSafetyComponent } from '../../ui/chapter-editor-safety/chapter-editor-safety.component';
import { ChapterVersionHistoryComponent } from '../../ui/chapter-version-history/chapter-version-history.component';
import { ChapterPricingComponent } from '../../ui/chapter-pricing/chapter-pricing.component';
import { AuthorChapterPricingInput } from '../../domain/author-story-management.models';
import { describeInsertAnchor, readInsertAnchor } from '../../domain/chapter-insert-anchor';

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
    ChapterTranslationWorkspaceComponent,
    AiAuthorToolsComponent,
    ChapterRichEditorComponent,
    MangaPageUploaderComponent,
    ChapterEditorSafetyComponent,
    ChapterVersionHistoryComponent,
    ChapterPricingComponent,
  ],
  providers: [
    AuthorChapterEditorStore,
    ChapterLocalRecoveryService,
    ChapterRecoveryQueueService,
    ChapterEditingSessionStore,
    ChapterWorkflowStore,
  ],
  templateUrl: './author-chapter-editor-page.component.html',
  styleUrls: ['./author-chapter-editor-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorChapterEditorPageComponent implements OnInit {
  canLeave(): Promise<boolean> {
    return this.session.canLeave();
  }
  @ViewChild(ChapterRichEditorComponent) private richEditor?: ChapterRichEditorComponent;
  protected readonly store = inject(AuthorChapterEditorStore);
  protected readonly session = inject(ChapterEditingSessionStore);
  protected readonly workflow = inject(ChapterWorkflowStore);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly storyId = this.route.snapshot.paramMap.get('storyId') ?? '';
  private readonly routeChapterId = this.route.snapshot.paramMap.get('chapterId');
  /** Mốc chèn do danh sách chương truyền sang qua query param. */
  private readonly insertAnchor = readInsertAnchor(this.route.snapshot.queryParamMap);
  protected readonly chapterId = computed(() => this.session.chapter()?.id ?? this.routeChapterId);
  protected readonly isCreate = computed(() => !this.chapterId());
  protected readonly insertNotice = computed(() =>
    this.isCreate() ? describeInsertAnchor(this.insertAnchor) : null,
  );
  protected readonly isManga = computed(() => this.store.story()?.format === 'MANGA');
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: [''],
  });
  protected readonly breadcrumbs = computed(() => [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Truyện của tôi', route: '/author-studio/truyen' },
    {
      label: this.store.story()?.title ?? 'Quản lý chương',
      route: `/author-studio/truyen/${this.storyId}/chuong`,
    },
    { label: this.isCreate() ? 'Viết chương mới' : 'Chỉnh sửa chương' },
  ]);
  // Mọi giai đoạn đều sửa được; với chương đã có, máy chủ quyết qua `canEdit`.
  protected readonly isEditable = computed(
    () => !!this.store.story() && (this.isCreate() || this.workflow.workflow()?.canEdit === true),
  );
  /** Chương đang hiện cho độc giả: mỗi lần lưu là họ thấy ngay. */
  protected readonly isLive = computed(() => this.session.chapter()?.status === 'PUBLISHED');
  protected readonly wordCount = computed(
    () => this.session.draft().content.trim().split(/\s+/).filter(Boolean).length,
  );
  protected readonly statusText = computed(
    () =>
      SAVE_STATUS_TEXT[this.session.status()] ??
      (this.session.dirty() ? 'Có thay đổi chưa lưu' : 'Sẵn sàng'),
  );

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      if (this.store.story() && !this.store.loading() && userId)
        void this.session.initialize(userId, this.storyId, this.store.chapter(), this.insertAnchor);
    });
    effect(() => {
      this.form.patchValue(this.session.draft(), { emitEvent: false });
      if (this.isEditable() && !this.session.restoring() && !this.workflow.busy())
        this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
    effect(() => {
      const id = this.chapterId();
      if (id && this.store.story()) void this.workflow.start(this.storyId, id);
    });
    effect(() => {
      const serverAhead =
        (this.workflow.workflow()?.version ?? 0) > (this.session.chapter()?.version ?? 0);
      if (serverAhead && !this.session.busy()) void this.session.synchronizeServer();
    });
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.session.change(this.form.getRawValue()));
  }

  ngOnInit(): void {
    this.store.load(this.storyId, this.routeChapterId);
    if (this.routeChapterId) this.store.loadHistory(this.storyId, this.routeChapterId);
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.session.dirty() || this.session.busy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  protected contentChanged(content: string): void {
    this.form.controls.content.setValue(content);
    this.form.controls.content.markAsDirty();
  }

  protected viewVersion(version: number): void {
    const id = this.chapterId();
    if (id) this.store.selectVersion(this.storyId, id, version);
  }

  protected loadMoreVersions(): void {
    const id = this.chapterId();
    if (id) this.store.loadMoreHistory(this.storyId, id);
  }

  protected toggleAutosaves(value: boolean): void {
    this.store.includeAutosaves.set(value);
    const id = this.chapterId();
    if (id) this.store.loadHistory(this.storyId, id);
  }

  protected compareVersion(version: number): void {
    const chapter = this.session.chapter();
    if (chapter) this.store.compare(this.storyId, chapter.id, version, chapter.version);
  }

  protected async restoreVersion(version: number): Promise<void> {
    if (!this.isEditable() || this.session.busy()) return;
    const confirmation = `Khôi phục phiên bản ${version} thành phiên bản mới? Các thay đổi chưa lưu trong trình soạn thảo sẽ bị thay thế.`;
    if (!window.confirm(confirmation)) return;
    const chapter = await this.session.restore(version);
    if (chapter) this.store.loadHistory(this.storyId, chapter.id);
  }

  protected async save(): Promise<void> {
    if (!this.isEditable() || this.form.invalid || this.session.busy()) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.store.setError('Nhập tiêu đề chương trước khi lưu.');
      return;
    }
    const wasNew = this.isCreate();
    const chapter = await this.session.save();
    if (!chapter) return;
    this.store.loadHistory(this.storyId, chapter.id);
    if (wasNew && !this.session.dirty())
      void this.router.navigate(['/author-studio/truyen', this.storyId, 'chuong', chapter.id]);
  }

  protected async transition(action: 'submit-review' | 'reopen'): Promise<void> {
    if (this.workflow.busy() || this.session.busy()) return;
    if (action === 'submit-review') {
      if (this.form.invalid || !(await this.session.save())) return;
      if (this.session.dirty()) return;
    }
    const chapter = this.session.chapter();
    if (!chapter) return;
    try {
      this.session.adoptChapter(await this.workflow.transition(action, chapter.version));
    } catch (error) {
      await this.session.handleError(error);
    }
  }

  protected saveMonetization(input: AuthorChapterPricingInput): void {
    const id = this.chapterId();
    if (!id || this.store.monetizationSaving()) return;
    this.store
      .updateMonetization(this.storyId, id, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (error: unknown) => this.store.setError(error) });
  }

  protected selectChapterImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) void this.insertIllustration(file);
  }

  /** Ảnh dán thẳng vào vùng soạn thảo: cùng đường tải lên với nút chọn ảnh. */
  protected pasteIllustration(pasted: { files: readonly File[]; error: string | null }): void {
    if (pasted.error) this.store.setError(pasted.error);
    for (const file of pasted.files) void this.insertIllustration(file);
  }

  private async insertIllustration(file: File): Promise<void> {
    const validationError = validateChapterImage(file);
    if (validationError) {
      this.store.setError(validationError);
      return;
    }
    if (this.isCreate()) await this.save();
    const id = this.chapterId();
    if (!id) return;
    this.store
      .uploadImage(id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (media) =>
          media.deliveryUrl
            ? this.richEditor?.insertImage(media.deliveryUrl, illustrationAlt(file.name))
            : this.store.setError('Ảnh đã tải lên nhưng chưa có URL phân phối.'),
        error: (error: unknown) => this.store.setError(error),
      });
  }

  protected async uploadMangaPages(files: readonly File[]): Promise<void> {
    if (this.isCreate()) await this.save();
    const id = this.chapterId();
    if (!id) return;
    this.store
      .uploadPages(this.storyId, id, files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected reorderMangaPages(orderedMediaAssetIds: readonly string[]): void {
    const id = this.chapterId();
    if (!id) return;
    this.store.reorderPages(this.storyId, id, orderedMediaAssetIds);
  }

  protected mangaPageAction(mediaAssetId: string, action: 'up' | 'down' | 'remove'): void {
    const id = this.chapterId();
    if (!id) return;
    if (action === 'remove') this.store.removePage(this.storyId, id, mediaAssetId);
    else this.store.movePage(this.storyId, id, mediaAssetId, action === 'up' ? -1 : 1);
  }
}

const SAVE_STATUS_TEXT: Readonly<Record<string, string>> = {
  saving: 'Đang lưu...',
  saved: 'Đã lưu',
  conflict: 'Có xung đột',
  error: 'Chưa lưu được — thử lưu lại',
};
