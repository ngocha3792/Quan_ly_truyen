import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../../components/account-center-icon/account-center-icon.component';
import { AccountCenterViewModel } from '../../state/account-center-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-account-overview-page',
  standalone: true,
  imports: [AccountCenterIconComponent, RouterLink, ButtonDirective, CardDirective],
  templateUrl: './overview-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountOverviewPageComponent extends AccountCenterViewModel {}
