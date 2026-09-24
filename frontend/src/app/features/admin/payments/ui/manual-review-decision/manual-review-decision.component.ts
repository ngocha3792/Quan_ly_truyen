import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { reference } from '../../domain/manual-review-order';
import { ManualReviewOrder } from '../../domain/admin-payment.models';

/** Khớp đúng luật của API: lý do 10–500 ký tự sau khi bỏ khoảng trắng thừa. */
const REASON_MIN = 10;
const REASON_MAX = 500;

@Component({
  selector: 'app-manual-review-decision',
  standalone: true,
  imports: [DecimalPipe, ButtonComponent, DialogShellComponent],
  templateUrl: './manual-review-decision.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualReviewDecisionComponent {
  readonly order = input<ManualReviewOrder | null>(null);
  readonly action = input<'confirm' | 'reject'>('confirm');
  readonly busy = input(false);

  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  protected readonly maxLength = REASON_MAX;
  protected readonly reference = reference;

  protected readonly trimmed = computed(() => this.reason().trim());
  protected readonly valid = computed(
    () => this.trimmed().length >= REASON_MIN && this.trimmed().length <= REASON_MAX,
  );

  protected readonly confirming = computed(() => this.action() === 'confirm');

  protected amount(order: ManualReviewOrder): number {
    const minor = Number(order.fiatAmountMinor);
    if (!Number.isFinite(minor)) return 0;
    return order.currency === 'VND' ? minor : minor / 100;
  }

  protected updateReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    if (!this.valid() || this.busy()) return;
    this.submitted.emit(this.trimmed());
    this.reason.set('');
  }

  protected dismiss(): void {
    this.reason.set('');
    this.dismissed.emit();
  }
}
