import { inject, Injectable, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminPaymentApiService } from './admin-payment-api.service';
import type {
  PaymentProviderConnection,
  PaymentProviderKindSchema,
} from '../domain/admin-payment.models';

@Injectable()
export class AdminPaymentProvidersStore {
  private readonly api = inject(AdminPaymentApiService);
  readonly providers = signal<readonly PaymentProviderConnection[]>([]);
  readonly kinds = signal<readonly PaymentProviderKindSchema[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    forkJoin({ providers: this.api.providers(), kinds: this.api.kinds() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ providers, kinds }) => {
          this.providers.set(providers);
          this.kinds.set(kinds);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải phương thức thanh toán.')),
      });
  }
}
