import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  BillingIntegritySummary,
  EMPTY_GATEWAY_FILTERS,
  GatewayFilters,
  GatewayOrder,
  GatewayTab,
  needsAttention,
} from '../domain/payment-gateway.models';
import { AdminPaymentGatewayApiService } from './admin-payment-gateway-api.service';

@Injectable()
export class AdminPaymentGatewayStore {
  private readonly api = inject(AdminPaymentGatewayApiService);

  readonly filters = signal<GatewayFilters>(EMPTY_GATEWAY_FILTERS);
  readonly tab = signal<GatewayTab>('all');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly totalItems = signal(0);
  readonly totalPages = signal(1);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly busyOrderId = signal<string | null>(null);
  readonly integrity = signal<BillingIntegritySummary | null>(null);

  private readonly rows = signal<readonly GatewayOrder[]>([]);

  /**
   * Tab "Cần kiểm tra" lọc ở client vì API chưa có tham số theo trạng thái
   * hoàn tiền; vì thế trang có thể hiện ít dòng hơn pageSize khi bật tab đó.
   */
  readonly orders = computed(() => {
    const tab = this.tab();
    if (tab === 'attention') return this.rows().filter((order) => needsAttention(order));
    if (tab === 'refunded') return this.rows().filter((order) => order.status === 'REFUNDED');
    if (tab === 'paid') return this.rows().filter((order) => order.status === 'PAID');
    return this.rows();
  });

  readonly hasRows = computed(() => this.orders().length > 0);

  readonly attentionCount = computed(
    () => this.rows().filter((order) => needsAttention(order)).length,
  );

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      page: this.api.orders(this.filters(), this.page(), this.pageSize()),
      integrity: this.api.integrity(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ page, integrity }) => {
          this.rows.set(page.items);
          this.totalItems.set(page.pagination.totalItems);
          this.totalPages.set(Math.max(1, page.pagination.totalPages));
          this.integrity.set(integrity);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải danh sách giao dịch.')),
      });
  }

  applyFilters(filters: GatewayFilters): void {
    this.filters.set(filters);
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    this.applyFilters(EMPTY_GATEWAY_FILTERS);
  }

  selectTab(tab: GatewayTab): void {
    this.tab.set(tab);
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

  reconcile(order: GatewayOrder): void {
    this.start(order);
    this.api
      .reconcile(order.id)
      .pipe(finalize(() => this.busyOrderId.set(null)))
      .subscribe({
        next: (result) => {
          this.notice.set(
            `${short(order)}: ${result.message} (cổng báo ${result.providerStatus}, hệ thống ${result.status}).`,
          );
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể đối soát đơn này.')),
      });
  }

  refundThroughProvider(order: GatewayOrder, reason: string, key: string): void {
    this.start(order);
    this.api
      .refund(order.id, reason, key)
      .pipe(finalize(() => this.busyOrderId.set(null)))
      .subscribe({
        next: (refund) => {
          this.notice.set(`${short(order)}: đã gửi lệnh hoàn tiền, trạng thái ${refund.status}.`);
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể hoàn tiền qua cổng.')),
      });
  }

  refundManually(
    order: GatewayOrder,
    reason: string,
    transferReference: string,
    key: string,
  ): void {
    this.start(order);
    this.api
      .refundManually(order.id, reason, transferReference, key)
      .pipe(finalize(() => this.busyOrderId.set(null)))
      .subscribe({
        next: () => {
          this.notice.set(
            `${short(order)}: đã ghi nhận chuyển trả ${transferReference} và thu lại Credit.`,
          );
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể ghi nhận hoàn tiền thủ công.')),
      });
  }

  private start(order: GatewayOrder): void {
    this.busyOrderId.set(order.id);
    this.error.set(null);
    this.notice.set(null);
  }
}

function short(order: GatewayOrder): string {
  return order.providerReference ?? order.id.slice(0, 8).toUpperCase();
}
