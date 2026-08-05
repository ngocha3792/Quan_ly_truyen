import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountCenterIconName } from '../../components/account-center-icon/account-center-icon.component';
import { AccountCenterViewModel } from '../../state/account-center-view-model';

import { ButtonDirective, CardDirective, DataTableDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-account-transactions-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective, DataTableDirective],
  templateUrl: './transactions-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTransactionsPageComponent extends AccountCenterViewModel {}
