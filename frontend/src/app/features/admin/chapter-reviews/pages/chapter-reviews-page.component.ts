import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { ChapterReviewApiService } from '../data-access/chapter-review-api.service';
import {
  ChapterReviewItem,
  ChapterReviewPage,
  ReviewDecision,
} from '../domain/chapter-review.models';

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
