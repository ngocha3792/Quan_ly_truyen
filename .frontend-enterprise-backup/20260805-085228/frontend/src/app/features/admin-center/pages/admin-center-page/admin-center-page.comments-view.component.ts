import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../../../shared/ui/admin-center-icon/admin-center-icon.component';
import { AdminCenterPageBase } from './admin-center-page.base';

@Component({
  selector: 'app-admin-center-comments-view',
  standalone: true,
  imports: [AdminCenterIconComponent],
  templateUrl: './admin-center-page.comments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCenterCommentsViewComponent extends AdminCenterPageBase {}
