import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountCenterIconName } from '../../components/account-center-icon/account-center-icon.component';
import { AccountCenterViewModel } from '../../state/account-center-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-account-comments-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './comments-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCommentsPageComponent extends AccountCenterViewModel {}
