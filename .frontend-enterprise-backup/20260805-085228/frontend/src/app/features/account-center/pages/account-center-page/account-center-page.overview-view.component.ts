import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../../../../shared/ui/account-center-icon/account-center-icon.component';
import { AccountCenterPageBase } from './account-center-page.base';

@Component({
  selector: 'app-account-center-overview-view',
  standalone: true,
  imports: [AccountCenterIconComponent, RouterLink],
  templateUrl: './account-center-page.overview-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCenterOverviewViewComponent extends AccountCenterPageBase {}
