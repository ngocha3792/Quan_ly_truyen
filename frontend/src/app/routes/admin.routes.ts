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
    path: 'admin/audit-logs',
    title: appPageTitle('Audit Logs'),
    canActivate: auditLogReadGuards,
    loadComponent: () =>
      import('../features/admin/audit-logs/pages/list/admin-audit-logs-list-page.component').then(
        (module) => module.AdminAuditLogsListPageComponent,
      ),
  },
  {
    path: 'admin/audit-logs/:id',
    title: appPageTitle('Chi tiết Audit Log'),
    canActivate: auditLogReadGuards,
    loadComponent: () =>
      import('../features/admin/audit-logs/pages/detail/admin-audit-log-detail-page.component').then(
        (module) => module.AdminAuditLogDetailPageComponent,
      ),
  },
  {
    path: 'admin/reports',
    title: appPageTitle('Báo cáo bình luận'),
    canActivate: reportReviewGuards,
    loadComponent: () =>
      import('../features/admin/reports/pages/list/admin-reports-list-page.component').then(
        (module) => module.AdminReportsListPageComponent,
      ),
  },
  {
    path: 'admin/reports/:reportId',
    title: appPageTitle('Chi tiết báo cáo'),
    canActivate: reportReviewGuards,
    loadComponent: () =>
      import('../features/admin/reports/pages/detail/admin-report-detail-page.component').then(
        (module) => module.AdminReportDetailPageComponent,
      ),
  },
  {
    path: 'admin/categories',
    title: appPageTitle('Quản lý thể loại'),
    canActivate: categoryManagementGuards,
    loadComponent: () =>
      import('../features/admin/categories/pages/list/admin-categories-list-page.component').then(
        (module) => module.AdminCategoriesListPageComponent,
      ),
  },
  {
    path: 'admin/tags',
    title: appPageTitle('Quản lý tag'),
    canActivate: tagManagementGuards,
    loadComponent: () =>
      import('../features/admin/tags/pages/list/admin-tags-list-page.component').then(
        (module) => module.AdminTagsListPageComponent,
      ),
  },
  {
    path: 'admin/stories',
    title: appPageTitle('Duyệt truyện'),
    canActivate: storyModerationGuards,
    loadComponent: () =>
      import('../features/admin/stories/pages/list/admin-stories-list-page.component').then(
        (module) => module.AdminStoriesListPageComponent,
      ),
  },
  {
    path: 'admin/story-submissions/:submissionId',
    title: appPageTitle('Chi tiết duyệt truyện'),
    canActivate: storyModerationGuards,
    loadComponent: () =>
      import('../features/admin/stories/pages/detail/admin-story-submission-detail-page.component').then(
        (module) => module.AdminStorySubmissionDetailPageComponent,
      ),
  },
  {
    path: 'admin/users',
    title: appPageTitle('Quản lý người dùng'),
    canActivate: userManagementGuards,
    loadComponent: () =>
      import('../features/admin/users/pages/list/admin-users-list-page.component').then(
        (module) => module.AdminUsersListPageComponent,
      ),
  },
  {
    path: 'admin/users/:userId',
    title: appPageTitle('Chi tiết người dùng'),
    canActivate: userManagementGuards,
    loadComponent: () =>
      import('../features/admin/users/pages/detail/admin-user-detail-page.component').then(
        (module) => module.AdminUserDetailPageComponent,
      ),
  },
  {
    path: 'admin/authors',
    title: appPageTitle('Quản lý tác giả'),
    canActivate: authorManagementGuards,
    loadComponent: () =>
      import('../features/admin/authors/pages/list/admin-authors-list-page.component').then(
        (module) => module.AdminAuthorsListPageComponent,
      ),
  },
  {
    path: 'admin/authors/:authorId',
    title: appPageTitle('Chi tiết tác giả'),
    canActivate: authorManagementGuards,
    loadComponent: () =>
      import('../features/admin/authors/pages/detail/admin-author-detail-page.component').then(
        (module) => module.AdminAuthorDetailPageComponent,
      ),
  },
  {
    path: 'admin/author-applications',
    title: appPageTitle('Xét duyệt hồ sơ tác giả'),
    canActivate: authorApplicationGuards,
    loadComponent: () =>
      import('../features/admin/author-applications/pages/list/admin-author-application-list-page.component').then(
        (module) => module.AdminAuthorApplicationListPageComponent,
      ),
  },
  {
    path: 'admin/author-applications/:applicationId',
    title: appPageTitle('Chi tiết hồ sơ tác giả'),
    canActivate: authorApplicationGuards,
    loadComponent: () =>
      import('../features/admin/author-applications/pages/detail/admin-author-application-detail-page.component').then(
        (module) => module.AdminAuthorApplicationDetailPageComponent,
      ),
  },
];
