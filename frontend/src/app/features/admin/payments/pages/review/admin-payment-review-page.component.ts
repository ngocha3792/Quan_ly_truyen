import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { AdminPaymentReviewStore } from '../../data-access/admin-payment-review.store';
import { ManualReviewOrder } from '../../domain/admin-payment.models';

@Component({
  selector: 'app-admin-payment-review-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  providers: [AdminPaymentReviewStore],
  templateUrl: './admin-payment-review-page.component.html',
  styleUrl: './admin-payment-review-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentReviewPageComponent implements OnInit {
  protected readonly store = inject(AdminPaymentReviewStore);
  protected readonly selected = signal<ManualReviewOrder | null>(null);
  protected readonly action = signal<'confirm' | 'reject'>('confirm');
  protected readonly reason = signal('');

  ngOnInit(): void {
    this.store.load();
  }

  protected open(order: ManualReviewOrder, action: 'confirm' | 'reject'): void {
    this.selected.set(order);
    this.action.set(action);
    this.reason.set('');
  }

  protected updateReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    const order = this.selected();
    const reason = this.reason().trim();
    if (!order || reason.length < 10 || reason.length > 500) return;
    this.store.review(order, this.action(), reason);
    this.selected.set(null);
  }

  protected claim(order: ManualReviewOrder, key: string): string {
    const value = order.transferClaim?.[key];
    return typeof value === 'string' ? value : '—';
  }
}
