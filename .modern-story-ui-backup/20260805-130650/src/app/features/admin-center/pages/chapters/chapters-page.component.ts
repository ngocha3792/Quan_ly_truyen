import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../components/admin-center-icon/admin-center-icon.component';
import { AdminCenterViewModel } from '../../state/admin-center-view-model';

import {
  ButtonDirective,
  CardDirective,
  DataTableDirective,
  StatusBadgeDirective,
} from '../../../../shared/ui';

@Component({
  selector: 'app-admin-chapters-page',
  standalone: true,
  imports: [
    AdminCenterIconComponent,
    ButtonDirective,
    CardDirective,
    DataTableDirective,
    StatusBadgeDirective,
  ],
  templateUrl: './chapters-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminChaptersPageComponent extends AdminCenterViewModel {}
