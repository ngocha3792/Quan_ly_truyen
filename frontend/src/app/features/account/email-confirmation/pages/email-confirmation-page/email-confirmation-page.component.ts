import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute } from '@angular/router';

import { AuthFlowPageShellComponent } from '../../../shared/ui/auth-flow-page-shell/auth-flow-page-shell.component';

import { provideEmailConfirmation } from '../../data-access/email-confirmation.providers';

import { EmailConfirmationStore } from '../../data-access/email-confirmation.store';

import { EmailConfirmationCardComponent } from '../../ui/email-confirmation-card/email-confirmation-card.component';

@Component({
  selector: 'app-email-confirmation-page',

  standalone: true,

  imports: [AuthFlowPageShellComponent, EmailConfirmationCardComponent],

  providers: [...provideEmailConfirmation(), EmailConfirmationStore],

  templateUrl: './email-confirmation-page.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailConfirmationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected readonly store = inject(EmailConfirmationStore);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    this.store.confirm(token);
  }
}
