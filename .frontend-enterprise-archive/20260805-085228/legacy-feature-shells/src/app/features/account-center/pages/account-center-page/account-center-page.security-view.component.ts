import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../../../../shared/ui/account-center-icon/account-center-icon.component';
import { AccountCenterPageBase } from './account-center-page.base';

@Component({
  selector: 'app-account-center-security-view',
  standalone: true,
  imports: [AccountCenterIconComponent],
  templateUrl: './account-center-page.security-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCenterSecurityViewComponent extends AccountCenterPageBase {}
