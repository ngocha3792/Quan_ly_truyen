import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../components/admin-center-icon/admin-center-icon.component';
import { AdminCenterViewModel } from '../../state/admin-center-view-model';

import { ButtonDirective, CardDirective, DataTableDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-admin-stories-page',
  standalone: true,
  imports: [
    AdminCenterIconComponent,
    RouterLink,
    ButtonDirective,
    CardDirective,
    DataTableDirective,
  ],
  templateUrl: './stories-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStoriesPageComponent extends AdminCenterViewModel {}
