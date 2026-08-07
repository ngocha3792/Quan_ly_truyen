import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { CurrentUser } from '../../../../../core/auth/auth.models';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';

import { AccountSecuritySummary } from '../../data/account-api.models';

@Component({
  selector: 'app-account-overview-card',
  standalone: true,
  imports: [RouterLink, IconComponent, UserAvatarComponent],
  templateUrl: './account-overview-card.component.html',
  styleUrl: './account-overview-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountOverviewCardComponent {
  readonly user = input.required<CurrentUser>();

  readonly membershipLabel = input('Thành viên');

  readonly joinedDays = input(1);

  readonly walletBalance = input(0);

  readonly security = input.required<AccountSecuritySummary>();

  readonly ringBackground = computed(() => {
    const score = this.security().score;

    return [
      'conic-gradient(',
      '#4cd269 0%,',
      `#4cd269 ${score}%,`,
      'rgba(89, 105, 137, .22)',
      `${score}%,`,
      'rgba(89, 105, 137, .22) 100%',
      ')',
    ].join(' ');
  });
}
