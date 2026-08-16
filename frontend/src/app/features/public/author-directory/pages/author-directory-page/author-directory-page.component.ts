import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../../core/auth/auth.store';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ContentLayoutComponent } from '../../../../../shared/components/content-layout/content-layout.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';

import { provideAuthorDirectory } from '../../data-access/author-directory.providers';

import { AuthorDirectoryStore } from '../../data-access/author-directory.store';

import { AuthorDirectorySort } from '../../domain/author-directory.models';

import { AuthorDirectorySidebarComponent } from '../../ui/author-directory-sidebar/author-directory-sidebar.component';

import { AuthorDirectoryToolbarComponent } from '../../ui/author-directory-toolbar/author-directory-toolbar.component';

import { AuthorListComponent } from '../../ui/author-list/author-list.component';

@Component({
  selector: 'app-author-directory-page',

  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    ContentLayoutComponent,
    PaginationComponent,

    AuthorDirectoryToolbarComponent,
    AuthorListComponent,
    AuthorDirectorySidebarComponent,
  ],

  providers: [...provideAuthorDirectory(), AuthorDirectoryStore],

  templateUrl: './author-directory-page.component.html',

  styleUrls: ['./author-directory-page.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorDirectoryPageComponent implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly store = inject(AuthorDirectoryStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',
      route: '/',
    },
    {
      label: 'Tác giả',
    },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  protected toggleFollow(authorId: string): void {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/dang-nhap'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.store.toggleFollow(authorId);
  }

  protected handleSortChange(sort: AuthorDirectorySort): void {
    this.store.setSort(sort);
  }
}
