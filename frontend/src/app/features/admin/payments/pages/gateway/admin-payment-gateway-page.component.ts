import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS } from '../../../../../core/auth/authorization.models';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { StatusBadgeComponent } from '../../../../../shared/components/status-badge/status-badge.component';
import { AdminPaymentGatewayApiService } from '../../data-access/admin-payment-gateway-api.service';
import { GatewayOrder, GatewayRefund } from '../../domain/payment-gateway.models';

@Component({
  selector: 'app-admin-payment-gateway-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonComponent,
    PageHeadingComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-payment-gateway-page.component.html',
  styleUrl: './admin-payment-gateway-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentGatewayPageComponent implements OnInit {
  private readonly api = inject(AdminPaymentGatewayApiService);
  private readonly auth = inject(AuthStore);
  private readonly refundKeys = new Map<string, string>();
  protected readonly orders = signal<readonly GatewayOrder[]>([]);
  protected readonly selected = signal<GatewayOrder | null>(null);
  protected readonly refunds = signal<readonly GatewayRefund[]>([]);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly historyReady = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly canRefund = computed(
    () => this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.PAYMENT_REFUND_ADMIN) ?? false,
  );
  protected readonly canReconcile = computed(
    () => this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.PAYMENT_RECONCILE_ADMIN) ?? false,
  );
  protected search = '';
  protected reason = '';
  protected confirmRefund = false;
  protected readonly statusLabels: Readonly<Record<string, string>> = {
    CREATED: 'Đang tạo',
    PENDING: 'Đang chờ',
    AWAITING_REVIEW: 'Chờ duyệt',
    PAID: 'Đã thanh toán',
    FAILED: 'Thất bại',
    EXPIRED: 'Hết hạn',
    REFUNDED: 'Đã hoàn tiền',
    REVERSED: 'Đã điều chỉnh',
    COMPLETED: 'Đã hoàn tiền',
    UNKNOWN: 'Chưa rõ kết quả',
  };

  ngOnInit(): void {
    this.load();
  }

  protected load(page = 1): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .orders(page, this.search)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.orders.set(result.items);
          this.page.set(page);
          this.totalPages.set(result.pagination.totalPages);
          this.totalItems.set(result.pagination.totalItems);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải đơn thanh toán.')),
      });
  }

  protected select(order: GatewayOrder): void {
    if (this.busy()) return;
    this.selected.set(order);
    this.refunds.set([]);
    this.reason = '';
    this.confirmRefund = false;
    this.error.set(null);
    this.message.set(null);
    this.loadRefunds(order.id);
  }

  protected reconcile(order: GatewayOrder): void {
    if (this.busy() || !order.providerConfigurationReady || !this.canReconcile()) return;
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api
      .reconcile(order.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.message.set(result.message);
          this.selected.update((current) =>
            current?.id === order.id ? { ...current, status: result.status } : current,
          );
          this.load(this.page());
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Chưa thể đối soát với cổng thanh toán.')),
      });
  }

  protected refund(): void {
    const order = this.selected();
    const reason = this.reason.trim();
    if (
      !order ||
      this.busy() ||
      !this.canRefund() ||
      !this.confirmRefund ||
      reason.length < 10 ||
      !this.refundable()
    )
      return;
    const key = this.refundKeys.get(order.id) ?? globalThis.crypto.randomUUID();
    this.refundKeys.set(order.id, key);
    this.busy.set(true);
    this.error.set(null);
    this.api
      .refund(order.id, reason, key)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (refund) => {
          if (refund.status === 'FAILED') this.refundKeys.delete(order.id);
          this.refunds.update((items) => [
            refund,
            ...items.filter((item) => item.id !== refund.id),
          ]);
          this.message.set(
            refund.status === 'COMPLETED'
              ? 'Cổng thanh toán đã xác nhận hoàn tiền.'
              : 'Đã ghi nhận yêu cầu hoàn tiền. Kiểm tra trạng thái trước khi thử lại.',
          );
          this.confirmRefund = false;
          this.load(this.page());
        },
        error: (error: unknown) =>
          this.error.set(
            getApiErrorMessage(error, 'Chưa thể hoàn tiền. Kiểm tra lịch sử trước khi thử lại.'),
          ),
      });
  }

  protected refundable(): boolean {
    const order = this.selected();
    return (
      !!order?.providerConfigurationReady &&
      this.historyReady() &&
      order.status === 'PAID' &&
      !this.refunds().some((item) => item.status !== 'FAILED')
    );
  }

  protected loadRefunds(orderId: string): void {
    this.historyReady.set(false);
    this.api.refunds(orderId).subscribe({
      next: (items) => {
        if (this.selected()?.id === orderId) {
          this.refunds.set(items);
          this.historyReady.set(true);
        }
      },
      error: (error: unknown) =>
        this.error.set(getApiErrorMessage(error, 'Không thể tải lịch sử hoàn tiền.')),
    });
  }
}
