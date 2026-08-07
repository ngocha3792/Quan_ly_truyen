import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { AccountActivityStore } from '../../data-access/account-activity.store';
import { ActivityCategory } from '../../domain/account-activity.models';

import { StatCardComponent } from '../../../../../../shared/components/stat-card/stat-card.component';
import { ActivityListComponent } from '../../ui/activity-list/activity-list.component';
import { ActivityToolbarComponent } from '../../ui/activity-toolbar/activity-toolbar.component';
import { RecentDevicesCardComponent } from '../../ui/recent-devices-card/recent-devices-card.component';
import { SuspiciousActivityCardComponent } from '../../ui/suspicious-activity-card/suspicious-activity-card.component';
import { WeeklySummaryCardComponent } from '../../ui/weekly-summary-card/weekly-summary-card.component';

@Component({
  selector: 'app-account-activity-page',

  standalone: true,

  imports: [
    StatCardComponent,
    ActivityToolbarComponent,
    ActivityListComponent,
    RecentDevicesCardComponent,
    SuspiciousActivityCardComponent,
    WeeklySummaryCardComponent,
  ],

  templateUrl: './account-activity-page.component.html',

  styleUrl: './account-activity-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountActivityPageComponent implements OnInit {
  protected readonly store = inject(AccountActivityStore);

  ngOnInit(): void {
    this.store.load();
  }

  protected changeCategory(category: ActivityCategory): void {
    this.store.setCategory(category);
  }

  protected changePeriod(period: 7 | 30 | 90): void {
    this.store.setPeriodDays(period);
  }
}
