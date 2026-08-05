import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AuthIconComponent } from '../auth-icon/auth-icon.component';
import { AuthBenefit } from '../../models/auth-benefit.model';

@Component({
  selector: 'app-auth-benefits',
  standalone: true,
  imports: [AuthIconComponent],
  templateUrl: './auth-benefits.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthBenefitsComponent {
  @Input() benefits: readonly AuthBenefit[] = [];
  @Input() variant: 'login' | 'register' = 'login';
}
