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
import { finalize, forkJoin, of } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS } from '../../../../core/auth/authorization.models';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminMonetizationApiService } from '../admin-monetization-api.service';
import {
  AdminChapterPurchase,
  AdminPaymentOrder,
  RevenueAnalytics,
} from '../admin-monetization.models';

@Component({
  selector: 'app-admin-monetization-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './admin-monetization-page.component.html',
  styleUrl: './admin-monetization-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMonetizationPageComponent implements OnInit {
  private readonly api = inject(AdminMonetizationApiService);
  private readonly auth = inject(AuthStore);

  protected readonly loading = signal(true);
  protected readonly actionPending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly orders = signal<readonly AdminPaymentOrder[]>([]);
  protected readonly purchases = signal<readonly AdminChapterPurchase[]>([]);
  protected readonly revenue = signal<RevenueAnalytics | null>(null);
  protected readonly canRefund = computed(() =>
    this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.PAYMENT_REFUND_ADMIN),
  );
  protected readonly canAdjust = computed(() =>
    this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.WALLET_ADJUST_ADMIN),
  );
  protected readonly canReadRevenue = computed(() =>
    this.auth.user()?.permissions.includes(AUTH_PERMISSIONS.ANALYTICS_READ),
  );

  protected search = '';
  protected refundPurchaseId: string | null = null;
  protected refundReason = '';
  protected adjustmentUserId = '';
  protected adjustmentDirection: 'CREDIT' | 'DEBIT' = 'CREDIT';
  protected adjustmentAmount = '';
  protected adjustmentReason = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      orders: this.api.paymentOrders(this.search),
      purchases: this.api.purchases(this.search),
      revenue: this.canReadRevenue() ? this.api.revenue() : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ orders, purchases, revenue }) => {
          this.orders.set(orders.items);
          this.purchases.set(purchases.items);
          this.revenue.set(revenue);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải dữ liệu vận hành Credit.')),
      });
  }

  protected selectRefund(purchase: AdminChapterPurchase): void {
    this.refundPurchaseId = purchase.id;
    this.refundReason = '';
    this.success.set(null);
  }

  protected submitRefund(): void {
    if (!this.refundPurchaseId || this.refundReason.trim().length < 10) return;
    this.runAction(
      this.api.refundPurchase(this.refundPurchaseId, this.refundReason.trim()),
      'Đã hoàn Credit và thu hồi quyền đọc.',
      () => {
        this.refundPurchaseId = null;
        this.refundReason = '';
      },
    );
  }

  protected submitAdjustment(): void {
    if (
      !this.adjustmentUserId.trim() ||
      !/^[1-9]\d*$/u.test(this.adjustmentAmount) ||
      this.adjustmentReason.trim().length < 10
    ) {
      return;
    }
    this.runAction(
      this.api.adjustWallet({
        userId: this.adjustmentUserId.trim(),
        direction: this.adjustmentDirection,
        amount: this.adjustmentAmount,
        reason: this.adjustmentReason.trim(),
      }),
      'Đã ghi điều chỉnh ví và audit log.',
      () => {
        this.adjustmentAmount = '';
        this.adjustmentReason = '';
      },
    );
  }

  protected statusClass(status: string): string {
    return status.toLocaleLowerCase('en');
  }

  private runAction(
    action: ReturnType<AdminMonetizationApiService['refundPurchase']>,
    message: string,
    complete: () => void,
  ): void {
    if (this.actionPending()) return;
    this.actionPending.set(true);
    this.error.set(null);
    this.success.set(null);
    action.pipe(finalize(() => this.actionPending.set(false))).subscribe({
      next: () => {
        complete();
        this.success.set(message);
        this.load();
      },
      error: (error: unknown) =>
        this.error.set(getApiErrorMessage(error, 'Thao tác vận hành thất bại.')),
    });
  }
}
