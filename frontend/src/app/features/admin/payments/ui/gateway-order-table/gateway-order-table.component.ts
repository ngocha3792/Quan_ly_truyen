import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '../../../../../shared/components/status-badge/status-badge.component';
import {
  GatewayOrder,
  refundState,
  supportsProviderOperations,
} from '../../domain/payment-gateway.models';

const ORDER_TONES: Readonly<Record<string, StatusBadgeTone>> = {
  PAID: 'success',
  REFUNDED: 'info',
  AWAITING_REVIEW: 'warning',
  PENDING: 'info',
  CREATED: 'neutral',
  FAILED: 'danger',
  EXPIRED: 'danger',
  REVERSED: 'neutral',
};

const ORDER_LABELS: Readonly<Record<string, string>> = {
  PAID: 'Đã thanh toán',
  REFUNDED: 'Đã hoàn tiền',
  AWAITING_REVIEW: 'Chờ xác nhận',
  PENDING: 'Đang chờ',
  CREATED: 'Vừa tạo',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  REVERSED: 'Đã đảo giao dịch',
};

const REFUND_LABELS: Readonly<Record<string, string>> = {
  NONE: '—',
  PENDING: 'Đang giữ Credit',
  COMPLETED: 'Đã hoàn',
  FAILED: 'Hoàn thất bại',
  UNKNOWN: 'Chưa rõ kết quả',
};

export type GatewayAction = 'reconcile' | 'refund' | 'refund-manual';

export interface GatewayActionRequest {
  readonly order: GatewayOrder;
  readonly action: GatewayAction;
}

@Component({
  selector: 'app-gateway-order-table',
  standalone: true,
  imports: [DatePipe, DecimalPipe, IconComponent, PaginationComponent, StatusBadgeComponent],
  templateUrl: './gateway-order-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewayOrderTableComponent {
  readonly orders = input.required<readonly GatewayOrder[]>();
  readonly loading = input(false);
  readonly busyOrderId = input<string | null>(null);
  readonly canReconcile = input(false);
  readonly canRefund = input(false);
  readonly page = input(1);
  readonly totalPages = input(1);
  readonly pageSize = input(10);
  readonly totalItems = input(0);

  readonly acted = output<GatewayActionRequest>();
  readonly pageChanged = output<number>();
  readonly pageSizeChanged = output<number>();

  protected readonly pageSizes = [10, 20, 50];
  protected readonly automated = supportsProviderOperations;

  protected tone(status: string): StatusBadgeTone {
    return ORDER_TONES[status] ?? 'neutral';
  }

  protected label(status: string): string {
    return ORDER_LABELS[status] ?? status;
  }

  protected refundLabel(order: GatewayOrder): string {
    return REFUND_LABELS[refundState(order)] ?? refundState(order);
  }

  protected amount(order: GatewayOrder): number {
    const minor = Number(order.fiatAmountMinor);
    if (!Number.isFinite(minor)) return 0;
    return order.currency === 'VND' ? minor : minor / 100;
  }

  protected reference(order: GatewayOrder): string {
    return order.providerReference ?? order.id.slice(0, 8).toUpperCase();
  }

  /** Chỉ đơn đã thu tiền và chưa có lệnh hoàn nào mới hoàn được. */
  protected canStartRefund(order: GatewayOrder): boolean {
    return (
      this.canRefund() && order.status === 'PAID' && ['NONE', 'FAILED'].includes(refundState(order))
    );
  }

  protected readPageSize(event: Event): void {
    this.pageSizeChanged.emit(Number((event.target as HTMLSelectElement).value));
  }
}
