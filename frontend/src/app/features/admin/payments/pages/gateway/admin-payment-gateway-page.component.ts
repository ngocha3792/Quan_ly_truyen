import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS } from '../../../../../core/auth/authorization.models';
import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { IconName } from '../../../../../shared/components/icon/icon.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../../shared/components/stat-card/stat-card.component';
import { AdminPaymentGatewayStore } from '../../data-access/admin-payment-gateway.store';
import { GatewayFilters, GatewayTab } from '../../domain/payment-gateway.models';
import { GatewayAsideComponent } from '../../ui/gateway-aside/gateway-aside.component';
import { GatewayFiltersComponent } from '../../ui/gateway-filters/gateway-filters.component';
import {
  GatewayRefundDialogComponent,
  GatewayRefundSubmission,
} from '../../ui/gateway-refund-dialog/gateway-refund-dialog.component';
import {
  GatewayActionRequest,
  GatewayOrderTableComponent,
} from '../../ui/gateway-order-table/gateway-order-table.component';

interface GatewayStat {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
  readonly icon: IconName;
  readonly tone: StatCardTone;
}

const TABS: readonly { id: GatewayTab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'paid', label: 'Đã thanh toán' },
  { id: 'refunded', label: 'Đã hoàn tiền' },
  { id: 'attention', label: 'Cần kiểm tra' },
];

@Component({
  selector: 'app-admin-payment-gateway-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    ButtonComponent,
    ErrorAlertComponent,
    PageHeadingComponent,
    StatCardComponent,
    GatewayAsideComponent,
    GatewayFiltersComponent,
    GatewayOrderTableComponent,
    GatewayRefundDialogComponent,
  ],
  providers: [AdminPaymentGatewayStore],
  templateUrl: './admin-payment-gateway-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentGatewayPageComponent implements OnInit {
  protected readonly store = inject(AdminPaymentGatewayStore);
  private readonly auth = inject(AuthStore);

  protected readonly tabs = TABS;
  protected readonly breadcrumbs = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị', route: '/admin' },
    { label: 'Đối soát & hoàn tiền' },
  ];

  protected readonly pending = signal<GatewayActionRequest | null>(null);

  protected readonly canRefund = computed(
    () => this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.PAYMENT_REFUND_ADMIN) ?? false,
  );
  protected readonly canReconcile = computed(
    () => this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.PAYMENT_RECONCILE_ADMIN) ?? false,
  );

  /**
   * Bốn số liệu lấy từ API đối soát, tính trên toàn bảng nên không đổi theo
   * trang đang xem. Đây là các dấu hiệu lệch sổ thật, thay cho mấy con số
   * trang trí không có nguồn dữ liệu.
   */
  protected readonly stats = computed<readonly GatewayStat[]>(() => {
    const summary = this.store.integrity();
    if (!summary) return [];
    return [
      {
        label: 'Đơn đã thanh toán',
        value: `${summary.paidOrders}`,
        meta: 'tổng số đơn đã thu tiền',
        icon: 'wallet',
        tone: 'purple',
      },
      {
        label: 'Thiếu bút toán ví',
        value: `${summary.paidOrdersWithoutLedger}`,
        meta: 'đã thu tiền nhưng chưa cộng Credit',
        icon: 'alert-triangle',
        tone: 'pink',
      },
      {
        label: 'Bút toán mồ côi',
        value: `${summary.orphanTopUpTransactions}`,
        meta: 'đã cộng Credit nhưng không có đơn',
        icon: 'alert-triangle',
        tone: 'orange',
      },
      {
        label: 'Đơn treo quá hạn',
        value: `${summary.pendingExpiredOrders}`,
        meta: 'chờ thanh toán nhưng đã hết hạn',
        icon: 'clock',
        tone: 'blue',
      },
    ];
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected applyFilters(filters: GatewayFilters): void {
    this.store.applyFilters(filters);
  }

  protected act(request: GatewayActionRequest): void {
    if (request.action === 'reconcile') {
      this.store.reconcile(request.order);
      return;
    }
    this.pending.set(request);
  }

  protected submitRefund(submission: GatewayRefundSubmission): void {
    const request = this.pending();
    if (!request) return;
    const key = `gw-${globalThis.crypto.randomUUID()}`;
    if (request.action === 'refund') {
      this.store.refundThroughProvider(request.order, submission.reason, key);
    } else {
      this.store.refundManually(
        request.order,
        submission.reason,
        submission.transferReference,
        key,
      );
    }
    this.pending.set(null);
  }

  /** Xuất đúng những dòng đang hiển thị — không gọi thêm API nào. */
  protected exportCsv(): void {
    const rows = this.store.orders();
    if (!rows.length) return;
    const header = [
      'Mã đơn',
      'Người thanh toán',
      'Email',
      'Nhà cung cấp',
      'Số tiền',
      'Tiền tệ',
      'Credit',
      'Trạng thái đơn',
      'Trạng thái hoàn tiền',
      'Cập nhật',
    ];
    const body = rows.map((order) => [
      order.providerReference ?? order.id,
      order.userDisplayName,
      order.userEmail,
      order.provider,
      order.fiatAmountMinor,
      order.currency,
      order.creditAmount,
      order.status,
      order.refund?.status ?? '',
      order.updatedAt,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/gu, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `doi-soat-hoan-tien-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
