import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ContentLayoutComponent } from '../../../../../shared/components/content-layout/content-layout.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';

import { provideNotifications } from '../../data-access/notifications.providers';

import { NotificationsStore } from '../../data-access/notifications.store';

import { NotificationCategory } from '../../domain/notifications.models';

import { NotificationsListComponent } from '../../ui/notifications-list/notifications-list.component';

import { NotificationsSidebarComponent } from '../../ui/notifications-sidebar/notifications-sidebar.component';

import { NotificationsToolbarComponent } from '../../ui/notifications-toolbar/notifications-toolbar.component';

@Component({
  selector: 'app-notifications-page',

  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    ContentLayoutComponent,
    PaginationComponent,

    NotificationsToolbarComponent,
    NotificationsListComponent,
    NotificationsSidebarComponent,
  ],

  providers: [...provideNotifications(), NotificationsStore],

  templateUrl: './notifications-page.component.html',

  styleUrls: ['./notifications-page.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  protected readonly store = inject(NotificationsStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',
      route: '/',
    },
    {
      label: 'Thông báo',
    },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  protected changeCategory(category: NotificationCategory): void {
    this.store.setCategory(category);
  }
}
