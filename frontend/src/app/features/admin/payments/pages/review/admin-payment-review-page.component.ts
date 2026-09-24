import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { IconName } from '../../../../../shared/components/icon/icon.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../../shared/components/stat-card/stat-card.component';
import { AdminPaymentReviewStore } from '../../data-access/admin-payment-review.store';
import { ManualReviewFilters, ManualReviewOrder } from '../../domain/admin-payment.models';
import { reference } from '../../domain/manual-review-order';
import { ManualReviewAsideComponent } from '../../ui/manual-review-aside/manual-review-aside.component';
import { ManualReviewDecisionComponent } from '../../ui/manual-review-decision/manual-review-decision.component';
import { ManualReviewFiltersComponent } from '../../ui/manual-review-filters/manual-review-filters.component';
import {
  ManualReviewDecision,
  ManualReviewTableComponent,
} from '../../ui/manual-review-table/manual-review-table.component';

interface ReviewStat {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
  readonly icon: IconName;
  readonly tone: StatCardTone;
}

@Component({
  selector: 'app-admin-payment-review-page',
  standalone: true,
  imports: [
    BreadcrumbComponent,
    ButtonComponent,
    ErrorAlertComponent,
    PageHeadingComponent,
    RouterLink,
    StatCardComponent,
    ManualReviewAsideComponent,
    ManualReviewDecisionComponent,
    ManualReviewFiltersComponent,
    ManualReviewTableComponent,
  ],
  providers: [AdminPaymentReviewStore],
  templateUrl: './admin-payment-review-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentReviewPageComponent implements OnInit {
  protected readonly store = inject(AdminPaymentReviewStore);
  private readonly features = inject(APP_RUNTIME_CONFIG).features;

  protected readonly breadcrumbs = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị', route: '/admin' },
    { label: 'Phương thức thanh toán', route: '/admin/settings/payments' },
    { label: 'Đối soát chuyển khoản' },
  ];

  protected readonly serviceEnabled =
    this.features.monetizationEnabled && this.features.paymentProviderEnabled;

  protected readonly decision = signal<ManualReviewDecision | null>(null);

  /**
   * Bốn số liệu đều lấy từ API đối soát (tính bằng SQL trên toàn bộ bảng), nên
   * không đổi theo trang đang xem và không suy đoán ở client.
   */
  protected readonly stats = computed<readonly ReviewStat[]>(() => {
    const summary = this.store.reconciliation();
    if (!summary) return [];
    return [
      {
        label: 'Đang chờ xác nhận',
        value: `${summary.awaitingReviewOrders}`,
        meta: 'đơn đang nằm trong hàng chờ',
        icon: 'clock',
        tone: 'orange',
      },
      {
        label: 'Tổng giá trị chờ duyệt',
        value: this.money(summary.awaitingReviewAmountMinor),
        meta: 'cộng trên toàn bộ đơn chờ duyệt',
        icon: 'wallet',
        tone: 'purple',
      },
      {
        label: 'Quá hạn xử lý',
        value: `${summary.awaitingReviewOlderThan24h}`,
        meta: 'đơn đã chờ quá 24 giờ',
        icon: 'alert-triangle',
        tone: 'pink',
      },
      {
        label: 'Đã xác nhận hôm nay',
        value: `${summary.confirmedToday}`,
        meta: 'đơn được cộng Credit hôm nay',
        icon: 'check',
        tone: 'green',
      },
    ];
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected applyFilters(filters: ManualReviewFilters): void {
    this.store.applyFilters(filters);
  }

  protected openDecision(decision: ManualReviewDecision): void {
    this.decision.set(decision);
  }

  protected submitDecision(reason: string): void {
    const pending = this.decision();
    if (!pending) return;
    this.store.review(pending.order, pending.action, reason);
    this.decision.set(null);
  }

  /** Xuất đúng những dòng đang hiển thị — không gọi thêm API nào. */
  protected exportCsv(): void {
    const rows = this.store.orders();
    if (!rows.length) return;
    const header = [
      'Mã giao dịch',
      'Người gửi',
      'Email',
      'Ngân hàng',
      'Số tiền',
      'Tiền tệ',
      'Credit',
      'Nội dung',
      'Thời gian gửi',
      'Trạng thái',
    ];
    const body = rows.map((order) => [
      reference(order),
      order.userDisplayName,
      order.userEmail,
      order.provider,
      order.fiatAmountMinor,
      order.currency,
      order.creditAmount,
      this.note(order),
      order.createdAt,
      order.status,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/gu, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `don-chuyen-khoan-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private note(order: ManualReviewOrder): string {
    const note = order.transferClaim?.['note'];
    return typeof note === 'string' && note.trim() ? note.trim() : order.packageLabel;
  }

  private money(minor: string): string {
    const value = Number(minor);
    if (!Number.isFinite(value)) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
  }
}
