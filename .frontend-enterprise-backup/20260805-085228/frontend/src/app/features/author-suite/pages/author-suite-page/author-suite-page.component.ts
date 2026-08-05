import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthorSuitePageBase } from './author-suite-page.base';
import { AuthorSuiteOverviewViewComponent } from './author-suite-page.overview-view.component';
import { AuthorSuiteStoriesViewComponent } from './author-suite-page.stories-view.component';
import { AuthorSuiteChaptersViewComponent } from './author-suite-page.chapters-view.component';
import { AuthorSuiteEditorViewComponent } from './author-suite-page.editor-view.component';
import { AuthorSuiteAnalyticsViewComponent } from './author-suite-page.analytics-view.component';
import { AuthorSuiteRevenueViewComponent } from './author-suite-page.revenue-view.component';
import { AuthorSuiteMessagesViewComponent } from './author-suite-page.messages-view.component';
import { AuthorSuiteNotificationsViewComponent } from './author-suite-page.notifications-view.component';
import { AuthorSuiteProfileViewComponent } from './author-suite-page.profile-view.component';
import { AuthorSuiteSettingsViewComponent } from './author-suite-page.settings-view.component';
import { AuthorSuiteSupportViewComponent } from './author-suite-page.support-view.component';
import { AuthorSuiteCommunityViewComponent } from './author-suite-page.community-view.component';

@Component({
  selector: 'app-author-suite-page',
  standalone: true,
  imports: [
    RouterLink,
    AuthorSuiteOverviewViewComponent,
    AuthorSuiteStoriesViewComponent,
    AuthorSuiteChaptersViewComponent,
    AuthorSuiteEditorViewComponent,
    AuthorSuiteAnalyticsViewComponent,
    AuthorSuiteRevenueViewComponent,
    AuthorSuiteMessagesViewComponent,
    AuthorSuiteNotificationsViewComponent,
    AuthorSuiteProfileViewComponent,
    AuthorSuiteSettingsViewComponent,
    AuthorSuiteSupportViewComponent,
    AuthorSuiteCommunityViewComponent,
  ],
  templateUrl: './author-suite-page.component.html',
  styleUrls: ['./author-suite-page.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuitePageComponent extends AuthorSuitePageBase {}
