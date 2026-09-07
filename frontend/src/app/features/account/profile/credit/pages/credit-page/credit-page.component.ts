import { DOCUMENT, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../../../../../../core/http/api-error.util';
import { CreditApiService } from '../../data-access/credit-api.service';
import {
  CreditPackage,
  CreditWallet,
  PaymentOrder,
  PaymentOrderStatus,
} from '../../domain/credit.models';

@Component({
  selector: 'app-credit-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './credit-page.component.html',
  styleUrl: './credit-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditPageComponent implements OnInit {
  private readonly api = inject(CreditApiService);
  private readonly document = inject(DOCUMENT);
  private readonly retryKeys = new Map<string, string>();

  protected readonly wallet = signal<CreditWallet | null>(null);
  protected readonly packages = signal<readonly CreditPackage[]>([]);
  protected readonly orders = signal<readonly PaymentOrder[]>([]);
  protected readonly loading = signal(true);
  protected readonly purchasingPackageId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      wallet: this.api.wallet(),
      packages: this.api.packages(),
      orders: this.api.orders(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ wallet, packages, orders }) => {
          this.wallet.set(wallet);
          this.packages.set(packages);
          this.orders.set(orders.items);
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'Tính năng Credit chưa sẵn sàng. Vui lòng quay lại sau.'),
          );
        },
      });
  }

  protected buy(creditPackage: CreditPackage): void {
    if (this.purchasingPackageId()) return;
    const idempotencyKey = this.retryKeys.get(creditPackage.id) ?? globalThis.crypto.randomUUID();
    this.retryKeys.set(creditPackage.id, idempotencyKey);
    this.purchasingPackageId.set(creditPackage.id);
    this.error.set(null);
    this.api
      .createOrder(creditPackage.id, idempotencyKey)
      .pipe(finalize(() => this.purchasingPackageId.set(null)))
      .subscribe({
        next: ({ order }) => {
          this.retryKeys.delete(creditPackage.id);
          if (!order.checkoutUrl) {
            this.error.set('Nhà cung cấp thanh toán chưa trả về địa chỉ thanh toán.');
            return;
          }
          this.document.location.assign(order.checkoutUrl);
        },
        error: (error: unknown) => {
          this.error.set(getApiErrorMessage(error, 'Không thể tạo đơn nạp Credit.'));
        },
      });
  }

  protected formatFiat(amountMinor: string, currency: string): string {
    const amount = Number(amountMinor) / (currency === 'VND' ? 1 : 100);
    if (!Number.isSafeInteger(Number(amountMinor)) || !Number.isFinite(amount)) return amountMinor;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount);
  }

  protected statusLabel(status: PaymentOrderStatus): string {
    const labels: Record<PaymentOrderStatus, string> = {
      CREATED: 'Đang tạo',
      PENDING: 'Chờ thanh toán',
      PAID: 'Đã cộng Credit',
      FAILED: 'Thất bại',
      EXPIRED: 'Hết hạn',
      REFUNDED: 'Đã hoàn tiền',
      REVERSED: 'Đã đảo giao dịch',
    };
    return labels[status];
  }
}
