import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../../components/account-center-icon/account-center-icon.component';
import { AccountCenterViewModel } from '../../state/account-center-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-account-following-page',
  standalone: true,
  imports: [AccountCenterIconComponent, ButtonDirective, CardDirective],
  templateUrl: './following-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountFollowingPageComponent extends AccountCenterViewModel {}
