import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { LinkButtonComponent } from '../../../../../shared/components/link-button/link-button.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { AuthorChaptersStore } from '../../data-access/author-chapters.store';
import {
  AuthorManagedChapterSummary,
  AuthorManagedStory,
} from '../../domain/author-story-management.models';
import { describeChapterDeleteWarning } from '../../domain/delete-warning';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-author-story-chapters-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    BreadcrumbComponent,
    PageHeadingComponent,
    ButtonComponent,
    LinkButtonComponent,
    PaginationComponent,
    LoadingStateComponent,
    NoticeComponent,
    EmptyStateComponent,
  ],
  providers: [AuthorChaptersStore],
  templateUrl: './author-story-chapters-page.component.html',
  styleUrl: './author-story-chapters-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorStoryChaptersPageComponent implements OnInit {
  protected readonly store = inject(AuthorChaptersStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly storyId = this.route.snapshot.paramMap.get('storyId') ?? '';
  protected readonly page = signal(1);
  protected readonly schedulingChapterId = signal<string | null>(null);
  protected readonly scheduleLocalValue = signal('');
  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.store.chapters().length / PAGE_SIZE)),
  );

  protected readonly pagedChapters = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.store.chapters().slice(start, start + PAGE_SIZE);
  });

  protected readonly breadcrumbs = computed(() => [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Truyện của tôi', route: '/author-studio/truyen' },
    { label: this.store.story()?.title ?? 'Quản lý chương' },
  ]);

  ngOnInit(): void {
    this.store.load(this.storyId);
  }

  protected goPage(page: number): void {
    this.page.set(page);
  }

  protected canCreate(): boolean {
    return true;
  }

  /** Số bản nháp gửi duyệt được; 0 thì nút gửi duyệt hàng loạt không hiện. */
  protected readonly draftCount = computed(
    () => this.store.chapters().filter((chapter) => chapter.status === 'DRAFT').length,
  );

  /** Số chương đã duyệt đang chờ lên bài. */
  protected readonly approvedCount = computed(
    () => this.store.chapters().filter((chapter) => chapter.status === 'APPROVED').length,
  );

  /**
   * Gửi duyệt hết bản nháp. Chương rỗng bị máy chủ bỏ qua kèm lý do chứ không
   * làm hỏng cả lô, nên không lọc trước ở đây.
   */
  protected submitAllDrafts(story: AuthorManagedStory): void {
    if (!window.confirm(`Gửi duyệt ${this.draftCount()} bản nháp của truyện này?`)) return;
    this.store.submitAllDrafts(story.id);
  }

  protected publishAllApproved(story: AuthorManagedStory): void {
    if (!window.confirm(`Xuất bản ${this.approvedCount()} chương đã duyệt ngay bây giờ?`)) return;
    this.store.publishAllApproved(story.id);
  }

  /**
   * Sửa được ở mọi giai đoạn: chương đang duyệt, đã duyệt, đã hẹn giờ hay đã
   * xuất bản đều mở, kể cả khi truyện đang chờ duyệt. Máy chủ cũng vậy; chỗ
   * duy nhất còn khoá là xoá chương.
   */
  protected canEdit(): boolean {
    return true;
  }

  /**
   * Chèn được sau bất kỳ chương nào: chương mới nhận số nằm giữa nên không
   * chương cũ nào bị đổi số hay đổi slug.
   */
  protected canInsertAfter(): boolean {
    return true;
  }

  /**
   * Chương đầu truyện, để chèn chương mở đầu phía trước nó. Đây là chỗ duy nhất
   * nút "Chèn chương sau" của từng dòng không với tới được.
   *
   * Lấy theo số nhỏ nhất chứ không lấy phần tử đầu mảng: trang này phân trang
   * phía client và không tự sắp xếp lại danh sách máy chủ trả về.
   */
  protected readonly firstChapter = computed(() =>
    this.store
      .chapters()
      .reduce<AuthorManagedChapterSummary | null>(
        (lowest, chapter) => (!lowest || chapter.number < lowest.number ? chapter : lowest),
        null,
      ),
  );

  /**
   * Xoá được ở mọi trạng thái, trừ khi truyện đang chờ duyệt: xoá giữa lượt
   * duyệt là rút nội dung ngay dưới tay người đang đọc để duyệt.
   */
  protected canDelete(story: AuthorManagedStory): boolean {
    return story.status !== 'PENDING_REVIEW';
  }

  /** Chương đang hiện cho độc giả — sửa là họ thấy ngay. */
  protected isLive(chapter: AuthorManagedChapterSummary): boolean {
    return chapter.status === 'PUBLISHED';
  }

  /**
   * Chương truyện tranh không có chữ nào nên `wordCount` luôn bằng 0; nội dung
   * của nó là các trang ảnh. Chỉ đếm chữ thì nút xuất bản và hẹn giờ không bao
   * giờ hiện ra cho truyện tranh.
   */
  protected canPublish(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return (
      story.status === 'PUBLISHED' &&
      (chapter.status === 'APPROVED' || chapter.status === 'SCHEDULED') &&
      (chapter.wordCount > 0 || chapter.pageCount > 0)
    );
  }

  protected canSchedule(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return this.canPublish(story, chapter);
  }

  protected deleteChapter(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (!this.canDelete(story)) return;
    if (!window.confirm(describeChapterDeleteWarning(chapter))) return;
    this.store.remove(story.id, chapter.id);
  }

  protected publishChapter(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (!this.canPublish(story, chapter)) return;
    const suffix = chapter.status === 'SCHEDULED' ? ' và xoá lịch hiện tại' : '';
    if (!window.confirm(`Xuất bản chương ${chapter.number}: “${chapter.title}” ngay${suffix}?`)) {
      return;
    }
    this.store.publish(story.id, chapter.id);
  }

  protected openSchedule(chapter: AuthorManagedChapterSummary): void {
    this.schedulingChapterId.set(chapter.id);
    this.scheduleLocalValue.set(
      toDateTimeLocalValue(
        chapter.scheduledAt ? new Date(chapter.scheduledAt) : defaultScheduleDate(),
      ),
    );
  }

  protected closeSchedule(): void {
    this.schedulingChapterId.set(null);
    this.scheduleLocalValue.set('');
  }

  protected updateScheduleValue(event: Event): void {
    this.scheduleLocalValue.set((event.target as HTMLInputElement).value);
  }

  protected scheduleChapter(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (!this.canSchedule(story, chapter)) return;
    const scheduledAt = new Date(this.scheduleLocalValue());
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) return;

    this.store.schedule(story.id, chapter.id, scheduledAt.toISOString());
    this.closeSchedule();
  }

  protected cancelSchedule(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (chapter.status !== 'SCHEDULED') return;
    if (!window.confirm(`Huỷ lịch xuất bản chương ${chapter.number}: “${chapter.title}”?`)) return;

    this.store.cancelSchedule(story.id, chapter.id);
    this.closeSchedule();
  }

  protected minimumScheduleValue(): string {
    return toDateTimeLocalValue(defaultScheduleDate());
  }
}

function defaultScheduleDate(): Date {
  const date = new Date(Date.now() + 15 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return date;
}

function toDateTimeLocalValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
