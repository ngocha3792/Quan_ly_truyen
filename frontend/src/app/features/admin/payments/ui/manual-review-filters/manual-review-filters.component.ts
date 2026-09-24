import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import {
  EMPTY_MANUAL_REVIEW_FILTERS,
  ManualReviewFilters,
  PAYMENT_ORDER_STATUSES,
  PaymentOrderStatus,
} from '../../domain/admin-payment.models';

const STATUS_LABELS: Readonly<Record<PaymentOrderStatus, string>> = {
  CREATED: 'Vừa tạo',
  PENDING: 'Chờ chuyển khoản',
  AWAITING_REVIEW: 'Chờ xác nhận',
  PAID: 'Đã xác nhận',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
  REVERSED: 'Đã đảo giao dịch',
};

@Component({
  selector: 'app-manual-review-filters',
  standalone: true,
  imports: [FormsModule, ButtonComponent, IconComponent],
  templateUrl: './manual-review-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualReviewFiltersComponent {
  readonly value = input.required<ManualReviewFilters>();
  readonly providers = input<readonly { code: string; label: string }[]>([]);
  readonly busy = input(false);

  readonly applied = output<ManualReviewFilters>();
  readonly cleared = output<void>();

  protected readonly statuses = PAYMENT_ORDER_STATUSES;
  protected readonly statusLabel = (status: PaymentOrderStatus): string => STATUS_LABELS[status];

  /** Bản nháp cục bộ: chỉ đẩy ra ngoài khi bấm Lọc, trừ ô quá hạn. */
  private readonly draft = signal<ManualReviewFilters | null>(null);
  protected readonly form = computed<ManualReviewFilters>(() => this.draft() ?? this.value());

  protected patch<K extends keyof ManualReviewFilters>(key: K, next: ManualReviewFilters[K]): void {
    this.draft.set({ ...this.form(), [key]: next });
  }

  protected readValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected toggleOverdue(event: Event): void {
    const overdueOnly = (event.target as HTMLInputElement).checked;
    const next = { ...this.form(), overdueOnly };
    this.draft.set(next);
    // Lọc quá hạn chạy ở client nên áp dụng ngay, không cần bấm Lọc.
    this.applied.emit(next);
  }

  protected submit(): void {
    this.applied.emit(this.form());
  }

  protected clear(): void {
    this.draft.set(EMPTY_MANUAL_REVIEW_FILTERS);
    this.cleared.emit();
  }
}
