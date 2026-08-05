import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountCenterIconName } from '../../../../shared/ui/account-center-icon/account-center-icon.component';
import { AccountCenterPageBase } from './account-center-page.base';

@Component({
  selector: 'app-account-center-history-view',
  standalone: true,
  imports: [],
  templateUrl: './account-center-page.history-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCenterHistoryViewComponent extends AccountCenterPageBase {}
