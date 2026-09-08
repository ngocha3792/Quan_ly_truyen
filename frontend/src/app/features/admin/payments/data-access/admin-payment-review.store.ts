import { inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ManualReviewOrder } from '../domain/admin-payment.models';
import { AdminPaymentApiService } from './admin-payment-api.service';

@Injectable()
export class AdminPaymentReviewStore {
  private readonly api = inject(AdminPaymentApiService);
  readonly orders = signal<readonly ManualReviewOrder[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.api
      .reviewQueue()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => this.orders.set(page.items),
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải hàng chờ đối soát.')),
      });
  }

  review(order: ManualReviewOrder, action: 'confirm' | 'reject', reason: string): void {
    const request =
      action === 'confirm' ? this.api.confirm(order.id, reason) : this.api.reject(order.id, reason);
    request.subscribe({
      next: () => this.load(),
      error: (error: unknown) =>
        this.error.set(getApiErrorMessage(error, 'Không thể cập nhật đơn.')),
    });
  }
}
