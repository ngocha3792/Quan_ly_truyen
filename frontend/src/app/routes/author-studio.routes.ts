import { Routes } from '@angular/router';
import { appPageTitle } from '../core/config/app-identity.constants';

import { authenticatedGuard } from '../core/auth/authenticated.guard';
import { AUTH_PERMISSIONS, AUTH_ROLES } from '../core/auth/authorization.models';
import { permissionGuard } from '../core/auth/permission.guard';
import { roleGuard } from '../core/auth/role.guard';
import { provideAuthorStoryManagement } from '../features/author-portal/author-studio/data-access/author-story-management.providers';
import {
  chapterEditorAccessGuard,
  chapterEditorLeaveGuard,
} from '../features/author-portal/author-studio/data-access/chapter-editor-access.guard';

/** Đoạn đường dẫn cố định đứng cùng vị trí với `:chapterId`. */
const CHAPTER_PATH_KEYWORDS = new Set(['tao-moi', 'nhap-file']);

export const AUTHOR_STUDIO_ROUTES: Routes = [
  {
    path: 'author-studio/truyen/:storyId/chuong/:chapterId',
    /*
     * Các đoạn đường dẫn cố định nằm cùng chỗ với `:chapterId` phải được loại
     * ra, không thì route này nuốt chúng và mở nhầm trình soạn thảo với một id
     * không có thật.
     */
    canMatch: [
      (_route, segments) => !CHAPTER_PATH_KEYWORDS.has(segments[segments.length - 1]?.path ?? ''),
    ],
    canActivate: [authenticatedGuard, chapterEditorAccessGuard],
    canDeactivate: [chapterEditorLeaveGuard],
    providers: provideAuthorStoryManagement(),
    title: appPageTitle('Chỉnh sửa chương'),
    loadComponent: () =>
      import('../features/author-portal/author-studio/pages/author-chapter-editor-page/author-chapter-editor-page.component').then(
        (module) => module.AuthorChapterEditorPageComponent,
      ),
  },
  {
    path: 'author-studio',
    canActivate: [
      authenticatedGuard,
      roleGuard(AUTH_ROLES.AUTHOR),
      permissionGuard(AUTH_PERMISSIONS.STORY_CREATE),
    ],
    providers: provideAuthorStoryManagement(),
    loadComponent: () =>
      import('../features/author-portal/author-studio/pages/author-studio-shell/author-studio-shell.component').then(
        (module) => module.AuthorStudioShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
      {
        path: 'tong-quan',
        title: appPageTitle('Tổng quan tác giả'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-dashboard-page/author-dashboard-page.component').then(
            (module) => module.AuthorDashboardPageComponent,
          ),
      },
      {
        path: 'ho-so',
        title: appPageTitle('Hồ sơ tác giả'),
        loadComponent: () =>
          import('../features/author-portal/author-profile/pages/author-profile-page/author-profile-page.component').then(
            (module) => module.AuthorProfilePageComponent,
          ),
      },
      {
        path: 'thong-ke',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.ANALYTICS_READ)],
        title: appPageTitle('Thống kê độc giả'),
        loadComponent: () =>
          import('../features/author-portal/analytics/pages/author-analytics-page/author-analytics-page.component').then(
            (module) => module.AuthorAnalyticsPageComponent,
          ),
      },
      {
        path: 'doanh-thu',
        title: appPageTitle('Doanh thu và rút tiền'),
        loadComponent: () =>
          import('../features/author-portal/revenue/pages/author-revenue-page.component').then(
            (module) => module.AuthorRevenuePageComponent,
          ),
      },
      {
        path: 'thong-ke/truyen/:storyId',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.ANALYTICS_READ)],
        title: appPageTitle('Thống kê truyện'),
        loadComponent: () =>
          import('../features/author-portal/analytics/pages/story-analytics-page/story-analytics-page.component').then(
            (module) => module.StoryAnalyticsPageComponent,
          ),
      },
      {
        path: 'truyen/tao-moi',
        title: appPageTitle('Tạo truyện'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-story-editor-page/author-story-editor-page.component').then(
            (module) => module.AuthorStoryEditorPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong/nhap-file',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_CREATE)],
        title: appPageTitle('Nhập chương từ file'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-chapter-import-page/author-chapter-import-page.component').then(
            (module) => module.AuthorChapterImportPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong/tao-moi',
        canDeactivate: [chapterEditorLeaveGuard],
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_CREATE)],
        title: appPageTitle('Viết chương mới'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-chapter-editor-page/author-chapter-editor-page.component').then(
            (module) => module.AuthorChapterEditorPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong/:chapterId',
        canDeactivate: [chapterEditorLeaveGuard],
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_UPDATE_OWN)],
        title: appPageTitle('Chỉnh sửa chương'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-chapter-editor-page/author-chapter-editor-page.component').then(
            (module) => module.AuthorChapterEditorPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_CREATE)],
        title: appPageTitle('Quản lý chương'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-story-chapters-page/author-story-chapters-page.component').then(
            (module) => module.AuthorStoryChaptersPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.STORY_UPDATE_OWN)],
        title: appPageTitle('Chỉnh sửa truyện'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-story-editor-page/author-story-editor-page.component').then(
            (module) => module.AuthorStoryEditorPageComponent,
          ),
      },
      {
        path: 'truyen',
        title: appPageTitle('Truyện của tôi'),
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-stories-page/author-stories-page.component').then(
            (module) => module.AuthorStoriesPageComponent,
          ),
      },
      { path: 'chuong/tao-moi', pathMatch: 'full', redirectTo: 'truyen' },
      { path: 'chuong', pathMatch: 'full', redirectTo: 'truyen' },
      { path: 'ban-nhap', pathMatch: 'full', redirectTo: 'truyen' },
      { path: '**', redirectTo: 'tong-quan' },
    ],
  },
];

export const AUTHOR_STUDIO_LEGACY_ROUTES: Routes = [
  { path: 'tac-gia-studio', pathMatch: 'full', redirectTo: '/author-studio' },
];
