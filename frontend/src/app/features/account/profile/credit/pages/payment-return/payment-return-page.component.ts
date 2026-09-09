import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { exhaustMap, take, takeWhile, timer } from 'rxjs';
import { getApiErrorMessage } from '../../../../../../core/http/api-error.util';
import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { CreditApiService } from '../../data-access/credit-api.service';
import { PaymentOrder } from '../../domain/credit.models';

@Component({
  selector: 'app-payment-return-page',
  imports: [RouterLink, DecimalPipe, ButtonComponent],
  templateUrl: './payment-return-page.component.html',
  styleUrl: './payment-return-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReturnPageComponent implements OnInit {
  private readonly api = inject(CreditApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly orderId = inject(ActivatedRoute).snapshot.queryParamMap.get('orderId');
  protected readonly order = signal<PaymentOrder | null>(null);
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.browser) this.refresh();
  }

  protected refresh(): void {
    if (this.checking()) return;
    if (!this.orderId || !/^[0-9a-f-]{36}$/i.test(this.orderId)) {
      this.error.set('Thiếu mã đơn hợp lệ. Vui lòng kiểm tra trong lịch sử nạp Credit.');
      return;
    }
    this.checking.set(true);
    this.error.set(null);
    timer(0, 3000)
      .pipe(
        take(20),
        exhaustMap(() => this.api.order(this.orderId!)),
        takeWhile((order) => order.status === 'CREATED' || order.status === 'PENDING', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => this.order.set(order),
        error: (error: unknown) => {
          this.checking.set(false);
          this.error.set(getApiErrorMessage(error, 'Chưa thể kiểm tra đơn thanh toán.'));
        },
        complete: () => this.checking.set(false),
      });
  }
}
