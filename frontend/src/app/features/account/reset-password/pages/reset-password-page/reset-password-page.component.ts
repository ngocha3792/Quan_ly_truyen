import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute } from '@angular/router';

import { AuthFlowPageShellComponent } from '../../../shared/ui/auth-flow-page-shell/auth-flow-page-shell.component';

import { provideResetPassword } from '../../data-access/reset-password.providers';

import { ResetPasswordStore } from '../../data-access/reset-password.store';

import { ResetPasswordCardComponent } from '../../ui/reset-password-card/reset-password-card.component';

@Component({
  selector: 'app-reset-password-page',

  standalone: true,

  imports: [AuthFlowPageShellComponent, ResetPasswordCardComponent],

  providers: [...provideResetPassword(), ResetPasswordStore],

  templateUrl: './reset-password-page.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected readonly store = inject(ResetPasswordStore);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? 'demo-reset-token';

    this.store.initialize(token);
  }
}
