import { Routes } from '@angular/router';

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

const reportReviewGuards = [
  authenticatedGuard,
  permissionGuard(AUTH_PERMISSIONS.REPORT_REVIEW),
];

const authorApplicationGuards = [
  authenticatedGuard,
  permissionGuard(AUTH_PERMISSIONS.AUTHOR_APPLICATION_REVIEW),
];

export const ADMIN_ROUTES: Routes = [
  {
    path: 'admin/reports',
    title: 'Báo cáo bình luận - TruyenHub',
    canActivate: reportReviewGuards,
    loadComponent: () =>
      import('../features/admin/reports/pages/list/admin-reports-list-page.component').then(
        (module) => module.AdminReportsListPageComponent,
      ),
  },
  {
    path: 'admin/reports/:reportId',
    title: 'Chi tiết báo cáo - TruyenHub',
    canActivate: reportReviewGuards,
    loadComponent: () =>
      import('../features/admin/reports/pages/detail/admin-report-detail-page.component').then(
        (module) => module.AdminReportDetailPageComponent,
      ),
  },
  {
    path: 'admin/categories',
    title: 'Quản lý thể loại - TruyenHub',
    canActivate: categoryManagementGuards,
    loadComponent: () =>
      import('../features/admin/categories/pages/list/admin-categories-list-page.component').then(
        (module) => module.AdminCategoriesListPageComponent,
      ),
  },
  {
    path: 'admin/tags',
    title: 'Quản lý tag - TruyenHub',
    canActivate: tagManagementGuards,
    loadComponent: () =>
      import('../features/admin/tags/pages/list/admin-tags-list-page.component').then(
        (module) => module.AdminTagsListPageComponent,
      ),
  },
  {
    path: 'admin/stories',
    title: 'Duyệt truyện - TruyenHub',
    canActivate: storyModerationGuards,
    loadComponent: () =>
      import('../features/admin/stories/pages/list/admin-stories-list-page.component').then(
        (module) => module.AdminStoriesListPageComponent,
      ),
  },
  {
    path: 'admin/story-submissions/:submissionId',
    title: 'Chi tiết duyệt truyện - TruyenHub',
    canActivate: storyModerationGuards,
    loadComponent: () =>
      import('../features/admin/stories/pages/detail/admin-story-submission-detail-page.component').then(
        (module) => module.AdminStorySubmissionDetailPageComponent,
      ),
  },
  {
    path: 'admin/users',
    title: 'Quản lý người dùng - TruyenHub',
    canActivate: userManagementGuards,
    loadComponent: () =>
      import('../features/admin/users/pages/list/admin-users-list-page.component').then(
        (module) => module.AdminUsersListPageComponent,
      ),
  },
  {
    path: 'admin/users/:userId',
    title: 'Chi tiết người dùng - TruyenHub',
    canActivate: userManagementGuards,
    loadComponent: () =>
      import('../features/admin/users/pages/detail/admin-user-detail-page.component').then(
        (module) => module.AdminUserDetailPageComponent,
      ),
  },
  {
    path: 'admin/authors',
    title: 'Quản lý tác giả - TruyenHub',
    canActivate: authorManagementGuards,
    loadComponent: () =>
      import('../features/admin/authors/pages/list/admin-authors-list-page.component').then(
        (module) => module.AdminAuthorsListPageComponent,
      ),
  },
  {
    path: 'admin/authors/:authorId',
    title: 'Chi tiết tác giả - TruyenHub',
    canActivate: authorManagementGuards,
    loadComponent: () =>
      import('../features/admin/authors/pages/detail/admin-author-detail-page.component').then(
        (module) => module.AdminAuthorDetailPageComponent,
      ),
  },
  {
    path: 'admin/author-applications',
    title: 'Xét duyệt hồ sơ tác giả - TruyenHub',
    canActivate: authorApplicationGuards,
    loadComponent: () =>
      import('../features/admin/author-applications/pages/list/admin-author-application-list-page.component').then(
        (module) => module.AdminAuthorApplicationListPageComponent,
      ),
  },
  {
    path: 'admin/author-applications/:applicationId',
    title: 'Chi tiết hồ sơ tác giả - TruyenHub',
    canActivate: authorApplicationGuards,
    loadComponent: () =>
      import('../features/admin/author-applications/pages/detail/admin-author-application-detail-page.component').then(
        (module) => module.AdminAuthorApplicationDetailPageComponent,
      ),
  },
];
