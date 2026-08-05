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
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../../../../shared/ui/account-center-icon/account-center-icon.component';

import { AccountCenterPageBase } from './account-center-page.base';
import { AccountCenterOverviewViewComponent } from './account-center-page.overview-view.component';
import { AccountCenterHistoryViewComponent } from './account-center-page.history-view.component';
import { AccountCenterLibraryViewComponent } from './account-center-page.library-view.component';
import { AccountCenterFollowingViewComponent } from './account-center-page.following-view.component';
import { AccountCenterReviewsViewComponent } from './account-center-page.reviews-view.component';
import { AccountCenterCommentsViewComponent } from './account-center-page.comments-view.component';
import { AccountCenterProfileViewComponent } from './account-center-page.profile-view.component';
import { AccountCenterSecurityViewComponent } from './account-center-page.security-view.component';
import { AccountCenterNotificationsViewComponent } from './account-center-page.notifications-view.component';
import { AccountCenterTransactionsViewComponent } from './account-center-page.transactions-view.component';

@Component({
  selector: 'app-account-center-page',
  standalone: true,
  imports: [
    AccountCenterIconComponent,
    RouterLink,
    AccountCenterOverviewViewComponent,
    AccountCenterHistoryViewComponent,
    AccountCenterLibraryViewComponent,
    AccountCenterFollowingViewComponent,
    AccountCenterReviewsViewComponent,
    AccountCenterCommentsViewComponent,
    AccountCenterProfileViewComponent,
    AccountCenterSecurityViewComponent,
    AccountCenterNotificationsViewComponent,
    AccountCenterTransactionsViewComponent,
  ],
  templateUrl: './account-center-page.component.html',
  styleUrls: ['./account-center-page.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCenterPageComponent extends AccountCenterPageBase {}
