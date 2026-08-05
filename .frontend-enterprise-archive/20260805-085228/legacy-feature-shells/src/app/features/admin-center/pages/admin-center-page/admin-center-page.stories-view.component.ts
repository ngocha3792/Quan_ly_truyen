import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../../../shared/ui/admin-center-icon/admin-center-icon.component';
import { AdminCenterPageBase } from './admin-center-page.base';

@Component({
  selector: 'app-admin-center-stories-view',
  standalone: true,
  imports: [AdminCenterIconComponent, RouterLink],
  templateUrl: './admin-center-page.stories-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCenterStoriesViewComponent extends AdminCenterPageBase {}
