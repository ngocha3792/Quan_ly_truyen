import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { GatewayOrder } from '../../domain/payment-gateway.models';

/** Khớp đúng luật API: lý do 5–500, mã chuyển trả 3–160 ký tự. */
const REASON_MIN = 5;
const REASON_MAX = 500;
const REFERENCE_MIN = 3;

export interface GatewayRefundSubmission {
  readonly reason: string;
  readonly transferReference: string;
}

@Component({
  selector: 'app-gateway-refund-dialog',
  standalone: true,
  imports: [DecimalPipe, ButtonComponent, DialogShellComponent],
  templateUrl: './gateway-refund-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewayRefundDialogComponent {
  readonly order = input<GatewayOrder | null>(null);
  /** true khi hoàn qua cổng, false khi admin tự chuyển trả rồi ghi nhận lại. */
  readonly automated = input(true);
  readonly busy = input(false);

  readonly submitted = output<GatewayRefundSubmission>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  protected readonly transferReference = signal('');
  protected readonly maxLength = REASON_MAX;

  protected readonly trimmedReason = computed(() => this.reason().trim());
  protected readonly trimmedReference = computed(() => this.transferReference().trim());

  protected readonly valid = computed(() => {
    const reasonOk =
      this.trimmedReason().length >= REASON_MIN && this.trimmedReason().length <= REASON_MAX;
    return this.automated()
      ? reasonOk
      : reasonOk && this.trimmedReference().length >= REFERENCE_MIN;
  });

  protected amount(order: GatewayOrder): number {
    const minor = Number(order.fiatAmountMinor);
    if (!Number.isFinite(minor)) return 0;
    return order.currency === 'VND' ? minor : minor / 100;
  }

  protected updateReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected updateReference(event: Event): void {
    this.transferReference.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    if (!this.valid() || this.busy()) return;
    this.submitted.emit({
      reason: this.trimmedReason(),
      transferReference: this.trimmedReference(),
    });
    this.reset();
  }

  protected dismiss(): void {
    this.reset();
    this.dismissed.emit();
  }

  private reset(): void {
    this.reason.set('');
    this.transferReference.set('');
  }
}
