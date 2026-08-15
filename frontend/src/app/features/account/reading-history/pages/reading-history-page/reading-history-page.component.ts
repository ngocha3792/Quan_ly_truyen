import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ContentLayoutComponent } from '../../../../../shared/components/content-layout/content-layout.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { provideReadingHistory } from '../../data-access/reading-history.providers';

import { ReadingHistoryStore } from '../../data-access/reading-history.store';

import { ReadingHistoryPeriod, ReadingHistorySort } from '../../domain/reading-history.models';

import { ReadingHistoryListComponent } from '../../ui/reading-history-list/reading-history-list.component';

import { ReadingHistorySidebarComponent } from '../../ui/reading-history-sidebar/reading-history-sidebar.component';

import { ReadingHistoryToolbarComponent } from '../../ui/reading-history-toolbar/reading-history-toolbar.component';

@Component({
  selector: 'app-reading-history-page',

  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    ContentLayoutComponent,
    ErrorAlertComponent,
    LoadingStateComponent,

    ReadingHistoryToolbarComponent,
    ReadingHistoryListComponent,
    ReadingHistorySidebarComponent,
  ],

  providers: [...provideReadingHistory(), ReadingHistoryStore],

  templateUrl: './reading-history-page.component.html',

  styleUrls: ['./reading-history-page.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingHistoryPageComponent implements OnInit {
  protected readonly store = inject(ReadingHistoryStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',
      route: '/',
    },
    {
      label: 'Lịch sử đọc',
    },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  protected changePeriod(period: ReadingHistoryPeriod): void {
    this.store.setPeriod(period);
  }

  protected changeSort(sort: ReadingHistorySort): void {
    this.store.setSort(sort);
  }
}
