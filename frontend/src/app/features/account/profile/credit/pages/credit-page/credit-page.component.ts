import { DOCUMENT, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../../../../../../core/http/api-error.util';
import { CreditApiService } from '../../data-access/credit-api.service';
import {
  CreditPackage,
  CreditWallet,
  PaymentOrder,
  PaymentOrderStatus,
  PaymentMethod,
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
  protected readonly storyId =
    inject(ActivatedRoute).snapshot.queryParamMap.get('storyId') ?? undefined;

  protected readonly wallet = signal<CreditWallet | null>(null);
  protected readonly packages = signal<readonly CreditPackage[]>([]);
  protected readonly orders = signal<readonly PaymentOrder[]>([]);
  protected readonly paymentMethods = signal<readonly PaymentMethod[]>([]);
  protected readonly selectedPaymentMethodId = signal<string | null>(null);
  protected readonly instructionOrder = signal<PaymentOrder | null>(null);
  protected readonly transferReference = signal('');
  protected readonly transferNote = signal('');
  protected readonly claiming = signal(false);
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
      paymentMethods: this.api.paymentMethods(this.storyId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ wallet, packages, orders, paymentMethods }) => {
          this.wallet.set(wallet);
          this.packages.set(packages);
          this.orders.set(orders.items);
          this.paymentMethods.set(paymentMethods);
          if (!this.selectedPaymentMethodId()) {
            this.selectedPaymentMethodId.set(paymentMethods[0]?.id ?? null);
          }
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'Tính năng Credit chưa sẵn sàng. Vui lòng quay lại sau.'),
          );
        },
      });
  }

  protected buy(creditPackage: CreditPackage): void {
    if (this.purchasingPackageId() || !this.selectedPaymentMethodId()) return;
    const selection = `${creditPackage.id}:${this.selectedPaymentMethodId()}:${this.storyId ?? ''}`;
    const idempotencyKey = this.retryKeys.get(selection) ?? globalThis.crypto.randomUUID();
    this.retryKeys.set(selection, idempotencyKey);
    this.purchasingPackageId.set(creditPackage.id);
    this.error.set(null);
    this.api
      .createOrder(
        creditPackage.id,
        idempotencyKey,
        this.selectedPaymentMethodId() ?? undefined,
        this.storyId,
      )
      .pipe(finalize(() => this.purchasingPackageId.set(null)))
      .subscribe({
        next: ({ order }) => {
          this.retryKeys.delete(selection);
          if (order.fulfilment.kind === 'redirect') {
            this.document.location.assign(order.fulfilment.checkoutUrl);
          } else if (order.fulfilment.kind === 'instructions') {
            this.instructionOrder.set(order);
            this.orders.update((items) => [order, ...items.filter((item) => item.id !== order.id)]);
          } else {
            this.error.set('Phương thức thanh toán chưa trả về hướng dẫn hợp lệ.');
          }
        },
        error: (error: unknown) => {
          this.error.set(getApiErrorMessage(error, 'Không thể tạo đơn nạp Credit.'));
        },
      });
  }

  protected selectPaymentMethod(event: Event): void {
    this.selectedPaymentMethodId.set((event.target as HTMLSelectElement).value || null);
  }

  protected updateTransferReference(event: Event): void {
    this.transferReference.set((event.target as HTMLInputElement).value);
  }

  protected updateTransferNote(event: Event): void {
    this.transferNote.set((event.target as HTMLTextAreaElement).value);
  }

  protected markTransferred(): void {
    const order = this.instructionOrder();
    if (!order || this.claiming()) return;
    this.claiming.set(true);
    this.api
      .markTransferred(order.id, {
        referenceCode: this.transferReference().trim() || undefined,
        note: this.transferNote().trim() || undefined,
      })
      .pipe(finalize(() => this.claiming.set(false)))
      .subscribe({
        next: (updated) => {
          this.instructionOrder.set(updated);
          this.orders.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể gửi xác nhận chuyển khoản.')),
      });
  }

  protected instruction(name: string): string {
    const order = this.instructionOrder();
    if (!order || order.fulfilment.kind !== 'instructions') return '';
    const value = order.fulfilment.instructions[name];
    return typeof value === 'string' ? value : '';
  }

  protected copy(value: string): void {
    void globalThis.navigator?.clipboard?.writeText(value);
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
      AWAITING_REVIEW: 'Chờ admin xác nhận',
      PAID: 'Đã cộng Credit',
      FAILED: 'Thất bại',
      EXPIRED: 'Hết hạn',
      REFUNDED: 'Đã hoàn tiền',
      REVERSED: 'Đã đảo giao dịch',
    };
    return labels[status];
  }
}
