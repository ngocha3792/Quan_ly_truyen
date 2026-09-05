import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { StatCardComponent } from '../../../../../shared/components/stat-card/stat-card.component';
import { AuthorStudioStore } from '../../data-access/author-studio.store';
import { AuthorStudioPeriod } from '../../domain/author-studio.models';
import { AuthorStoryTableComponent } from '../../ui/author-story-table/author-story-table.component';
import { DashboardBottomPanelsComponent } from '../../ui/dashboard-bottom-panels/dashboard-bottom-panels.component';
import { ReaderCommentsComponent } from '../../ui/reader-comments/reader-comments.component';
import { ReadershipChartComponent } from '../../ui/readership-chart/readership-chart.component';
import { RecentDraftsComponent } from '../../ui/recent-drafts/recent-drafts.component';

@Component({
  selector: 'app-author-dashboard-page',
  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    StatCardComponent,
    ReadershipChartComponent,
    AuthorStoryTableComponent,
    RecentDraftsComponent,
    ReaderCommentsComponent,
    DashboardBottomPanelsComponent,
  ],

  templateUrl: './author-dashboard-page.component.html',

  styleUrl: './author-dashboard-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorDashboardPageComponent {
  protected readonly store = inject(AuthorStudioStore);

  protected readonly breadcrumbs = [{ label: 'Author Studio' }];

  protected changePeriod(period: AuthorStudioPeriod): void {
    this.store.setPeriod(period);
  }
}
