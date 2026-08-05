import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminCenterIconName } from '../../../../shared/ui/admin-center-icon/admin-center-icon.component';
import { AdminCenterPageBase } from './admin-center-page.base';

@Component({
  selector: 'app-admin-center-settings-view',
  standalone: true,
  imports: [],
  templateUrl: './admin-center-page.settings-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCenterSettingsViewComponent extends AdminCenterPageBase {}
