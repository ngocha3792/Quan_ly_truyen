import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminCenterIconName } from '../../components/admin-center-icon/admin-center-icon.component';
import { AdminCenterViewModel } from '../../state/admin-center-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-admin-settings-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './settings-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsPageComponent extends AdminCenterViewModel {}
