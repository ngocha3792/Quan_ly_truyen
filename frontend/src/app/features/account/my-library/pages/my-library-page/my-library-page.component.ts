import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ContentLayoutComponent } from '../../../../../shared/components/content-layout/content-layout.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { provideMyLibrary } from '../../data-access/my-library.providers';

import { MyLibraryStore } from '../../data-access/my-library.store';

import { LibraryFilter, LibrarySort, LibraryViewMode } from '../../domain/my-library.models';

import { LibrarySidebarComponent } from '../../ui/library-sidebar/library-sidebar.component';

import { LibraryStoryListComponent } from '../../ui/library-story-list/library-story-list.component';

import { LibraryToolbarComponent } from '../../ui/library-toolbar/library-toolbar.component';

@Component({
  selector: 'app-my-library-page',

  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    ContentLayoutComponent,
    ErrorAlertComponent,
    LoadingStateComponent,

    LibraryToolbarComponent,
    LibraryStoryListComponent,
    LibrarySidebarComponent,
  ],

  providers: [...provideMyLibrary(), MyLibraryStore],

  templateUrl: './my-library-page.component.html',

  styleUrls: ['./my-library-page.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyLibraryPageComponent implements OnInit {
  protected readonly store = inject(MyLibraryStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',
      route: '/',
    },
    {
      label: 'Thư viện của tôi',
    },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  protected changeFilter(filter: LibraryFilter): void {
    this.store.setFilter(filter);
  }

  protected changeSort(sort: LibrarySort): void {
    this.store.setSort(sort);
  }

  protected changeViewMode(viewMode: LibraryViewMode): void {
    this.store.setViewMode(viewMode);
  }
}
