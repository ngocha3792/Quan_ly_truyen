import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../../../shared/ui/admin-center-icon/admin-center-icon.component';

import { AdminCenterPageBase } from './admin-center-page.base';
import { AdminCenterOverviewViewComponent } from './admin-center-page.overview-view.component';
import { AdminCenterStoriesViewComponent } from './admin-center-page.stories-view.component';
import { AdminCenterChaptersViewComponent } from './admin-center-page.chapters-view.component';
import { AdminCenterUsersViewComponent } from './admin-center-page.users-view.component';
import { AdminCenterAuthorsViewComponent } from './admin-center-page.authors-view.component';
import { AdminCenterCommentsViewComponent } from './admin-center-page.comments-view.component';
import { AdminCenterReportsViewComponent } from './admin-center-page.reports-view.component';
import { AdminCenterCategoriesViewComponent } from './admin-center-page.categories-view.component';
import { AdminCenterTransactionsViewComponent } from './admin-center-page.transactions-view.component';
import { AdminCenterAdsViewComponent } from './admin-center-page.ads-view.component';
import { AdminCenterSettingsViewComponent } from './admin-center-page.settings-view.component';
import { AdminCenterActivityViewComponent } from './admin-center-page.activity-view.component';

@Component({
  selector: 'app-admin-center-page',
  standalone: true,
  imports: [
    AdminCenterIconComponent,
    RouterLink,
    AdminCenterOverviewViewComponent,
    AdminCenterStoriesViewComponent,
    AdminCenterChaptersViewComponent,
    AdminCenterUsersViewComponent,
    AdminCenterAuthorsViewComponent,
    AdminCenterCommentsViewComponent,
    AdminCenterReportsViewComponent,
    AdminCenterCategoriesViewComponent,
    AdminCenterTransactionsViewComponent,
    AdminCenterAdsViewComponent,
    AdminCenterSettingsViewComponent,
    AdminCenterActivityViewComponent,
  ],
  templateUrl: './admin-center-page.component.html',
  styleUrls: ['./admin-center-page.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCenterPageComponent extends AdminCenterPageBase {}
