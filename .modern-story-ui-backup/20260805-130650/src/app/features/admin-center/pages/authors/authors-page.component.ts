import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../components/admin-center-icon/admin-center-icon.component';
import { AdminCenterViewModel } from '../../state/admin-center-view-model';

import { ButtonDirective, CardDirective, DataTableDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-admin-authors-page',
  standalone: true,
  imports: [AdminCenterIconComponent, ButtonDirective, CardDirective, DataTableDirective],
  templateUrl: './authors-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuthorsPageComponent extends AdminCenterViewModel {}
