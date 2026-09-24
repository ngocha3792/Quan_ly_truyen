import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '../../../../../shared/components/status-badge/status-badge.component';
import { isOverdue, reference } from '../../domain/manual-review-order';
import { ManualReviewOrder, PaymentOrderStatus } from '../../domain/admin-payment.models';

const STATUS_VIEW: Readonly<Record<PaymentOrderStatus, { label: string; tone: StatusBadgeTone }>> =
  {
    CREATED: { label: 'Vừa tạo', tone: 'neutral' },
    PENDING: { label: 'Chờ chuyển khoản', tone: 'info' },
    AWAITING_REVIEW: { label: 'Chờ xác nhận', tone: 'warning' },
    PAID: { label: 'Đã xác nhận', tone: 'success' },
    FAILED: { label: 'Thất bại', tone: 'danger' },
    EXPIRED: { label: 'Hết hạn', tone: 'danger' },
    REFUNDED: { label: 'Đã hoàn tiền', tone: 'neutral' },
    REVERSED: { label: 'Đã đảo giao dịch', tone: 'neutral' },
  };

export interface ManualReviewDecision {
  readonly order: ManualReviewOrder;
  readonly action: 'confirm' | 'reject';
}

@Component({
  selector: 'app-manual-review-table',
  standalone: true,
  imports: [DatePipe, DecimalPipe, IconComponent, PaginationComponent, StatusBadgeComponent],
  templateUrl: './manual-review-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualReviewTableComponent {
  readonly orders = input.required<readonly ManualReviewOrder[]>();
  readonly loading = input(false);
  readonly reviewingId = input<string | null>(null);
  readonly page = input(1);
  readonly totalPages = input(1);
  readonly pageSize = input(10);
  readonly totalItems = input(0);

  readonly decided = output<ManualReviewDecision>();
  readonly pageChanged = output<number>();
  readonly pageSizeChanged = output<number>();

  protected readonly pageSizes = [10, 20, 50];
  protected readonly overdue = isOverdue;
  protected readonly reference = reference;

  protected status(order: ManualReviewOrder) {
    return STATUS_VIEW[order.status];
  }

  /** Số tiền lưu ở đơn vị nhỏ nhất; VND không có phần lẻ nên chia 1. */
  protected amount(order: ManualReviewOrder): number {
    const minor = Number(order.fiatAmountMinor);
    if (!Number.isFinite(minor)) return 0;
    return order.currency === 'VND' ? minor : minor / 100;
  }

  protected note(order: ManualReviewOrder): string {
    const note = order.transferClaim?.['note'];
    if (typeof note === 'string' && note.trim()) return note.trim();
    return order.packageLabel;
  }

  protected readPageSize(event: Event): void {
    this.pageSizeChanged.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected canReview(order: ManualReviewOrder): boolean {
    return order.status === 'AWAITING_REVIEW';
  }
}
