import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconName } from '../../../../../shared/components/icon/icon.component';
import { StatCardComponent } from '../../../../../shared/components/stat-card/stat-card.component';
import { AuthorStudioStore } from '../../data-access/author-studio.store';
import { AuthorStudioPeriod, StudioIconName } from '../../domain/author-studio.models';
import { AuthorStoryTableComponent } from '../../ui/author-story-table/author-story-table.component';
import { DashboardBottomPanelsComponent } from '../../ui/dashboard-bottom-panels/dashboard-bottom-panels.component';
import { ReaderCommentsComponent } from '../../ui/reader-comments/reader-comments.component';
import { ReadershipChartComponent } from '../../ui/readership-chart/readership-chart.component';
import { RecentDraftsComponent } from '../../ui/recent-drafts/recent-drafts.component';

const METRIC_ICON_MAP: Partial<Record<StudioIconName, IconName>> = {
  book: 'book',
  eye: 'eye',
  users: 'users',
  draft: 'edit',
};

@Component({
  selector: 'app-author-dashboard-page',
  standalone: true,

  imports: [
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

  protected changePeriod(period: AuthorStudioPeriod): void {
    this.store.setPeriod(period);
  }

  protected metricIcon(icon: StudioIconName): IconName {
    return METRIC_ICON_MAP[icon] ?? 'activity';
  }
}
