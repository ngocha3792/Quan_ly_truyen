import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthorStudioStore } from '../../data-access/author-studio.store';
import { AuthorStudioPeriod } from '../../domain/author-studio.models';
import { AuthorStoryTableComponent } from '../../ui/author-story-table/author-story-table.component';
import { DashboardBottomPanelsComponent } from '../../ui/dashboard-bottom-panels/dashboard-bottom-panels.component';
import { PublicationScheduleComponent } from '../../ui/publication-schedule/publication-schedule.component';
import { ReaderCommentsComponent } from '../../ui/reader-comments/reader-comments.component';
import { ReadershipChartComponent } from '../../ui/readership-chart/readership-chart.component';
import { RecentDraftsComponent } from '../../ui/recent-drafts/recent-drafts.component';
import { StudioStatCardComponent } from '../../ui/studio-stat-card/studio-stat-card.component';

@Component({
  selector: 'app-author-dashboard-page',
  standalone: true,

  imports: [
    StudioStatCardComponent,
    ReadershipChartComponent,
    PublicationScheduleComponent,
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

  protected changePeriod(period: AuthorStudioPeriod): void {
    this.store.setPeriod(period);
  }
}
