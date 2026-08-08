import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { AuthorApplicationStatusComponent } from '../../ui/author-application-status/author-application-status.component';
import { ContentLayoutComponent } from '../../../../../shared/components/content-layout/content-layout.component';

import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { provideAuthorApplication } from '../../data-access/author-application.providers';

import { AuthorApplicationStore } from '../../data-access/author-application.store';

import {
  AuthorApplicationDraft,
  AuthorApplicationPayload,
} from '../../domain/author-application.models';

import { AuthorApplicationFormComponent } from '../../ui/author-application-form/author-application-form.component';

import { AuthorApplicationSidebarComponent } from '../../ui/author-application-sidebar/author-application-sidebar.component';

@Component({
  selector: 'app-author-application-page',

  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    ContentLayoutComponent,

    ErrorAlertComponent,
    LoadingStateComponent,

    AuthorApplicationFormComponent,
    AuthorApplicationSidebarComponent,
    AuthorApplicationStatusComponent,
  ],

  providers: [...provideAuthorApplication(), AuthorApplicationStore],

  templateUrl: './author-application-page.component.html',

  styleUrl: './author-application-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorApplicationPageComponent implements OnInit {
  protected readonly store = inject(AuthorApplicationStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',
      route: '/',
    },
    {
      label: 'Tác giả',
      route: '/tac-gia',
    },
    {
      label: 'Trở thành tác giả',
    },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  protected handleSaveDraft(draft: AuthorApplicationDraft): void {
    this.store.saveDraft(draft);
  }

  protected handleSubmit(payload: AuthorApplicationPayload): void {
    this.store.submit(payload);
  }
}
