import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { EMPTY_GATEWAY_FILTERS, GatewayFilters } from '../../domain/payment-gateway.models';

const STATUSES: readonly { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'AWAITING_REVIEW', label: 'Chờ xác nhận' },
  { value: 'PENDING', label: 'Đang chờ' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'REVERSED', label: 'Đã đảo giao dịch' },
];

@Component({
  selector: 'app-gateway-filters',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './gateway-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewayFiltersComponent {
  readonly value = input.required<GatewayFilters>();
  readonly busy = input(false);

  readonly applied = output<GatewayFilters>();
  readonly cleared = output<void>();

  protected readonly statuses = STATUSES;

  private readonly draft = signal<GatewayFilters | null>(null);
  protected readonly form = computed<GatewayFilters>(() => this.draft() ?? this.value());

  protected patch<K extends keyof GatewayFilters>(key: K, next: GatewayFilters[K]): void {
    this.draft.set({ ...this.form(), [key]: next });
  }

  protected readValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected submit(): void {
    this.applied.emit(this.form());
  }

  protected clear(): void {
    this.draft.set(EMPTY_GATEWAY_FILTERS);
    this.cleared.emit();
  }
}
