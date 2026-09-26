import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import {
  describeSkippedBulkChapters,
  summariseBulkChapterResult,
} from '../../../../shared/utils/bulk-chapter-result.util';
import { ChapterReviewApiService } from '../data-access/chapter-review-api.service';
import {
  ChapterReviewItem,
  ChapterReviewPage,
  ReviewDecision,
} from '../domain/chapter-review.models';

interface StoryGroup {
  readonly storyId: string;
  readonly storyTitle: string;
  readonly items: readonly ChapterReviewItem[];
}

@Component({
  selector: 'app-chapter-reviews-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    NoticeComponent,
    PageHeadingComponent,
    PaginationComponent,
  ],
  templateUrl: './chapter-reviews-page.component.html',
  styleUrl: './chapter-reviews-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterReviewsPageComponent implements OnInit {
  private readonly api = inject(ChapterReviewApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly result = signal<ChapterReviewPage | null>(null);
  protected readonly selected = signal<ChapterReviewItem | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected decision: ReviewDecision = 'APPROVED';
  protected comment = '';
  protected readonly Math = Math;
  protected readonly skippedLines = signal<readonly string[]>([]);
  /**
   * Hàng chờ gom theo truyện, để nút "duyệt hết truyện này" có chỗ đứng tự
   * nhiên thay vì lặp lại trên từng dòng của cùng một truyện.
   */
  protected readonly groups = computed<readonly StoryGroup[]>(() => {
    const byStory = new Map<string, ChapterReviewItem[]>();

    for (const item of this.result()?.items ?? []) {
      const bucket = byStory.get(item.chapter.storyId);
      if (bucket) bucket.push(item);
      else byStory.set(item.chapter.storyId, [item]);
    }

    return [...byStory].map(([storyId, items]) => ({
      storyId,
      storyTitle: items[0].storyTitle,
      items,
    }));
  });
  ngOnInit() {
    this.load(1);
  }

  protected load(page: number) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .list(page)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  protected open(item: ChapterReviewItem) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .get(item.chapter.id)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.selected.set(detail);
          this.comment = '';
          this.decision = 'APPROVED';
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  /**
   * Duyệt hết chương đang chờ. `storyId` rỗng là toàn hệ thống.
   *
   * Hỏi lại trước khi chạy vì đây là cú bấm duyệt hàng loạt nội dung mà người
   * bấm chưa đọc từng chương một.
   */
  protected approveAll(storyId?: string, label?: string) {
    if (this.busy()) return;
    const scope = storyId ? `truyện “${label}”` : 'TOÀN BỘ hệ thống';
    if (!window.confirm(`Duyệt mọi chương đang chờ của ${scope}?`)) return;

    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    this.skippedLines.set([]);
    this.api
      .approveAll(storyId)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.success.set(summariseBulkChapterResult(result, 'duyệt'));
          this.skippedLines.set(describeSkippedBulkChapters(result));
          this.load(this.result()?.page ?? 1);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  protected submit() {
    const item = this.selected();
    if (!item || this.busy() || (this.decision !== 'APPROVED' && !this.comment.trim())) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .review(item.chapter.id, item.chapter.version, this.decision, this.comment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.selected.set(null);
          this.success.set('Đã lưu quyết định duyệt chương.');
          this.load(this.result()?.page ?? 1);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.error.set(getApiErrorMessage(error));
        },
      });
  }
}
