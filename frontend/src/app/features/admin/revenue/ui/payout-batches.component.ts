import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { formatCredits, PayoutBatch } from '../../../../core/revenue/revenue.models';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { RevenueStatusComponent } from '../../../../shared/components/revenue-status/revenue-status.component';

@Component({
  selector: 'app-payout-batches',
  standalone: true,
  imports: [IconComponent, RevenueStatusComponent],
  templateUrl: './payout-batches.component.html',
  styleUrl: './payout-batches.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayoutBatchesComponent {
  readonly batches = input.required<readonly PayoutBatch[]>();
  readonly pending = input(false);
  readonly exportRequested = output<string>();
  protected readonly format = formatCredits;
}
