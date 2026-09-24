import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  EMPTY_MANUAL_REVIEW_FILTERS,
  ManualReviewFilters,
  ManualReviewOrder,
  PaymentReconciliation,
} from '../domain/admin-payment.models';
import { isOverdue, reference } from '../domain/manual-review-order';
import { AdminPaymentApiService } from './admin-payment-api.service';

@Injectable()
export class AdminPaymentReviewStore {
  private readonly api = inject(AdminPaymentApiService);

  readonly filters = signal<ManualReviewFilters>(EMPTY_MANUAL_REVIEW_FILTERS);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly totalItems = signal(0);
  readonly totalPages = signal(1);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly reviewing = signal<string | null>(null);
  readonly reconciliation = signal<PaymentReconciliation | null>(null);

  private readonly rows = signal<readonly ManualReviewOrder[]>([]);

  /**
   * API chưa có tham số "chỉ đơn quá hạn" nên lọc nốt ở client. Vì thế khi bật
   * bộ lọc này, tổng số trang vẫn là của server và có trang hiện ít dòng hơn.
   */
  readonly orders = computed(() =>
    this.filters().overdueOnly ? this.rows().filter((order) => isOverdue(order)) : this.rows(),
  );

  readonly hasRows = computed(() => this.orders().length > 0);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      page: this.api.reviewQueue(this.filters(), this.page(), this.pageSize()),
      reconciliation: this.api.reconciliation(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ page, reconciliation }) => {
          this.rows.set(page.items);
          this.totalItems.set(page.pagination.totalItems);
          this.totalPages.set(Math.max(1, page.pagination.totalPages));
          this.reconciliation.set(reconciliation);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải hàng chờ đối soát.')),
      });
  }

  applyFilters(filters: ManualReviewFilters): void {
    this.filters.set(filters);
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    this.applyFilters(EMPTY_MANUAL_REVIEW_FILTERS);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  changePageSize(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
    this.load();
  }

  review(order: ManualReviewOrder, action: 'confirm' | 'reject', reason: string): void {
    this.reviewing.set(order.id);
    this.error.set(null);
    this.notice.set(null);
    const request =
      action === 'confirm' ? this.api.confirm(order.id, reason) : this.api.reject(order.id, reason);
    request.pipe(finalize(() => this.reviewing.set(null))).subscribe({
      next: () => {
        this.notice.set(
          action === 'confirm'
            ? `Đã xác nhận đơn ${reference(order)} và cộng Credit cho người gửi.`
            : `Đã từ chối đơn ${reference(order)}.`,
        );
        this.load();
      },
      error: (error: unknown) =>
        this.error.set(getApiErrorMessage(error, 'Không thể cập nhật đơn.')),
    });
  }
}
