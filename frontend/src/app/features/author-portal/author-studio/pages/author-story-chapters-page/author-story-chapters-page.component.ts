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

  protected canCreate(story: AuthorManagedStory): boolean {
    return story.status !== 'PENDING_REVIEW';
  }

  protected canEdit(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return story.status !== 'PENDING_REVIEW' && chapter.status === 'DRAFT';
  }

  protected canPublish(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return (
      story.status === 'PUBLISHED' &&
      (chapter.status === 'DRAFT' || chapter.status === 'SCHEDULED') &&
      chapter.wordCount > 0
    );
  }

  protected canSchedule(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return this.canPublish(story, chapter);
  }

  protected deleteChapter(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (!this.canEdit(story, chapter)) return;
    if (!window.confirm(`Xóa bản nháp chương ${chapter.number}: “${chapter.title}”?`)) return;
    this.store.deleteDraft(story.id, chapter.id);
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
