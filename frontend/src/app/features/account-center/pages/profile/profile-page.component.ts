import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../../components/account-center-icon/account-center-icon.component';
import { AccountCenterViewModel } from '../../state/account-center-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-account-profile-page',
  standalone: true,
  imports: [AccountCenterIconComponent, ButtonDirective, CardDirective],
  templateUrl: './profile-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountProfilePageComponent extends AccountCenterViewModel {}
