import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthFlowPageShellComponent } from '../../../shared/ui/auth-flow-page-shell/auth-flow-page-shell.component';

import { provideForgotPassword } from '../../data-access/forgot-password.providers';

import { ForgotPasswordStore } from '../../data-access/forgot-password.store';

import { ForgotPasswordCardComponent } from '../../ui/forgot-password-card/forgot-password-card.component';

@Component({
  selector: 'app-forgot-password-page',

  standalone: true,

  imports: [AuthFlowPageShellComponent, ForgotPasswordCardComponent],

  providers: [...provideForgotPassword(), ForgotPasswordStore],

  templateUrl: './forgot-password-page.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPageComponent {
  protected readonly store = inject(ForgotPasswordStore);
}
