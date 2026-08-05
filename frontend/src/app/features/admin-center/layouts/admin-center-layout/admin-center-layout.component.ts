import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { WorkspaceLayoutComponent } from '../../../../layouts/workspace-layout/workspace-layout.component';
import { AdminCenterFacade } from '../../state/admin-center.facade';
import { ADMIN_NAVIGATION } from '../../config/admin-navigation.config';

@Component({
  selector: 'app-admin-center-layout',
  standalone: true,
  imports: [WorkspaceLayoutComponent],
  providers: [AdminCenterFacade],
  templateUrl: './admin-center-layout.component.html',
  styleUrls: ['../../styles/admin-center.pages.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCenterLayoutComponent {
  readonly navigation = ADMIN_NAVIGATION;
}
