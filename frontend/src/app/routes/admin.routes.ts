import { Routes } from '@angular/router';
import { appPageTitle } from '../core/config/app-identity.constants';

import { authenticatedGuard } from '../core/auth/authenticated.guard';
import { AUTH_PERMISSIONS } from '../core/auth/authorization.models';
import { permissionGuard } from '../core/auth/permission.guard';

const userManagementGuards = [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.USER_MANAGE)];

const storyModerationGuards = [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.STORY_REVIEW)];

const authorManagementGuards = [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.AUTHOR_READ)];

const tagManagementGuards = [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.TAG_MANAGE)];

const categoryManagementGuards = [
  authenticatedGuard,
  permissionGuard(AUTH_PERMISSIONS.CATEGORY_MANAGE),
];

const reportReviewGuards = [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.REPORT_REVIEW)];

const auditLogReadGuards = [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.AUDIT_LOG_READ)];

const authorApplicationGuards = [
  authenticatedGuard,
  permissionGuard(AUTH_PERMISSIONS.AUTHOR_APPLICATION_REVIEW),
];

export const ADMIN_ROUTES: Routes = [
  {
    path: 'admin',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('../features/admin/shell/pages/admin-shell/admin-shell.component').then(
        (module) => module.AdminShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'audit-logs',
        title: appPageTitle('Nhật ký audit'),
        canActivate: auditLogReadGuards,
        loadComponent: () =>
          import('../features/admin/audit-logs/pages/list/admin-audit-logs-list-page.component').then(
            (module) => module.AdminAuditLogsListPageComponent,
          ),
      },
      {
        path: 'audit-logs/:id',
        title: appPageTitle('Chi tiết audit log'),
        canActivate: auditLogReadGuards,
        loadComponent: () =>
          import('../features/admin/audit-logs/pages/detail/admin-audit-log-detail-page.component').then(
            (module) => module.AdminAuditLogDetailPageComponent,
          ),
      },
      {
        path: 'reports',
        title: appPageTitle('Báo cáo bình luận'),
        canActivate: reportReviewGuards,
        loadComponent: () =>
          import('../features/admin/reports/pages/list/admin-reports-list-page.component').then(
            (module) => module.AdminReportsListPageComponent,
          ),
      },
      {
        path: 'reports/:reportId',
        title: appPageTitle('Chi tiết báo cáo'),
        canActivate: reportReviewGuards,
        loadComponent: () =>
          import('../features/admin/reports/pages/detail/admin-report-detail-page.component').then(
            (module) => module.AdminReportDetailPageComponent,
          ),
      },
      {
        path: 'categories',
        title: appPageTitle('Quản lý thể loại'),
        canActivate: categoryManagementGuards,
        loadComponent: () =>
          import('../features/admin/categories/pages/list/admin-categories-list-page.component').then(
            (module) => module.AdminCategoriesListPageComponent,
          ),
      },
      {
        path: 'tags',
        title: appPageTitle('Quản lý tag'),
        canActivate: tagManagementGuards,
        loadComponent: () =>
          import('../features/admin/tags/pages/list/admin-tags-list-page.component').then(
            (module) => module.AdminTagsListPageComponent,
          ),
      },
      {
        path: 'stories',
        title: appPageTitle('Duyệt truyện'),
        canActivate: storyModerationGuards,
        loadComponent: () =>
          import('../features/admin/stories/pages/list/admin-stories-list-page.component').then(
            (module) => module.AdminStoriesListPageComponent,
          ),
      },
      {
        path: 'story-submissions/:submissionId',
        title: appPageTitle('Chi tiết duyệt truyện'),
        canActivate: storyModerationGuards,
        loadComponent: () =>
          import('../features/admin/stories/pages/detail/admin-story-submission-detail-page.component').then(
            (module) => module.AdminStorySubmissionDetailPageComponent,
          ),
      },
      {
        path: 'users',
        title: appPageTitle('Quản lý người dùng'),
        canActivate: userManagementGuards,
        loadComponent: () =>
          import('../features/admin/users/pages/list/admin-users-list-page.component').then(
            (module) => module.AdminUsersListPageComponent,
          ),
      },
      {
        path: 'users/:userId',
        title: appPageTitle('Chi tiết người dùng'),
        canActivate: userManagementGuards,
        loadComponent: () =>
          import('../features/admin/users/pages/detail/admin-user-detail-page.component').then(
            (module) => module.AdminUserDetailPageComponent,
          ),
      },
      {
        path: 'authors',
        title: appPageTitle('Quản lý tác giả'),
        canActivate: authorManagementGuards,
        loadComponent: () =>
          import('../features/admin/authors/pages/list/admin-authors-list-page.component').then(
            (module) => module.AdminAuthorsListPageComponent,
          ),
      },
      {
        path: 'authors/:authorId',
        title: appPageTitle('Chi tiết tác giả'),
        canActivate: authorManagementGuards,
        loadComponent: () =>
          import('../features/admin/authors/pages/detail/admin-author-detail-page.component').then(
            (module) => module.AdminAuthorDetailPageComponent,
          ),
      },
      {
        path: 'author-applications',
        title: appPageTitle('Xét duyệt hồ sơ tác giả'),
        canActivate: authorApplicationGuards,
        loadComponent: () =>
          import('../features/admin/author-applications/pages/list/admin-author-application-list-page.component').then(
            (module) => module.AdminAuthorApplicationListPageComponent,
          ),
      },
      {
        path: 'author-applications/:applicationId',
        title: appPageTitle('Chi tiết hồ sơ tác giả'),
        canActivate: authorApplicationGuards,
        loadComponent: () =>
          import('../features/admin/author-applications/pages/detail/admin-author-application-detail-page.component').then(
            (module) => module.AdminAuthorApplicationDetailPageComponent,
          ),
      },
    ],
  },
];
