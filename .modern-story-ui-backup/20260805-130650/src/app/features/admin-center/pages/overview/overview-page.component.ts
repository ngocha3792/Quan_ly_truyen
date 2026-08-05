import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../components/admin-center-icon/admin-center-icon.component';
import { AdminCenterViewModel } from '../../state/admin-center-view-model';

import { CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-admin-overview-page',
  standalone: true,
  imports: [AdminCenterIconComponent, RouterLink, CardDirective],
  templateUrl: './overview-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewPageComponent extends AdminCenterViewModel {}
