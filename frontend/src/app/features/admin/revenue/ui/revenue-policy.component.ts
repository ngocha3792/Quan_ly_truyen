import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { RevenuePolicy } from '../../../../core/revenue/revenue.models';

@Component({
  selector: 'app-revenue-policy',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './revenue-policy.component.html',
  styleUrl: './revenue-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevenuePolicyComponent {
  readonly policy = input.required<RevenuePolicy>();
  readonly pending = input(false);
  readonly save = output<RevenuePolicy>();
  protected form: { -readonly [K in keyof RevenuePolicy]: RevenuePolicy[K] } | null = null;
  constructor() {
    effect(() => {
      this.form = { ...this.policy() };
    });
  }
}
