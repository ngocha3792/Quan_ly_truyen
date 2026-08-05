import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { WorkspaceLayoutComponent } from '../../../../layouts/workspace-layout/workspace-layout.component';
import { AccountCenterFacade } from '../../state/account-center.facade';
import { ACCOUNT_NAVIGATION } from '../../config/account-navigation.config';

@Component({
  selector: 'app-account-center-layout',
  standalone: true,
  imports: [WorkspaceLayoutComponent],
  providers: [AccountCenterFacade],
  templateUrl: './account-center-layout.component.html',
  styleUrls: ['../../styles/account-center.pages.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCenterLayoutComponent {
  readonly navigation = ACCOUNT_NAVIGATION;
}
