import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountCenterIconName } from '../../components/account-center-icon/account-center-icon.component';
import { AccountCenterViewModel } from '../../state/account-center-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-account-notifications-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './notifications-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountNotificationsPageComponent extends AccountCenterViewModel {}
