import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-social-auth-buttons',
  standalone: true,
  imports: [ButtonDirective],
  templateUrl: './social-auth-buttons.component.html',
  host: { class: 'social-grid' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialAuthButtonsComponent {}
