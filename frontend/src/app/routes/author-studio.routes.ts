import { Routes } from '@angular/router';

import { authenticatedGuard } from '../core/auth/authenticated.guard';
import { AUTH_PERMISSIONS, AUTH_ROLES } from '../core/auth/authorization.models';
import { permissionGuard } from '../core/auth/permission.guard';
import { roleGuard } from '../core/auth/role.guard';
import { provideAuthorStoryManagement } from '../features/author-portal/author-studio/data-access/author-story-management.providers';

export const AUTHOR_STUDIO_ROUTES: Routes = [
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
        title: 'Tổng quan tác giả - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-dashboard-page/author-dashboard-page.component').then(
            (module) => module.AuthorDashboardPageComponent,
          ),
      },
      {
        path: 'truyen/tao-moi',
        title: 'Tạo truyện - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-story-editor-page/author-story-editor-page.component').then(
            (module) => module.AuthorStoryEditorPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong/tao-moi',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_CREATE)],
        title: 'Viết chương mới - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-chapter-editor-page/author-chapter-editor-page.component').then(
            (module) => module.AuthorChapterEditorPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong/:chapterId',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_UPDATE_OWN)],
        title: 'Chỉnh sửa chương - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-chapter-editor-page/author-chapter-editor-page.component').then(
            (module) => module.AuthorChapterEditorPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId/chuong',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.CHAPTER_CREATE)],
        title: 'Quản lý chương - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-story-chapters-page/author-story-chapters-page.component').then(
            (module) => module.AuthorStoryChaptersPageComponent,
          ),
      },
      {
        path: 'truyen/:storyId',
        canActivate: [permissionGuard(AUTH_PERMISSIONS.STORY_UPDATE_OWN)],
        title: 'Chỉnh sửa truyện - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-story-editor-page/author-story-editor-page.component').then(
            (module) => module.AuthorStoryEditorPageComponent,
          ),
      },
      {
        path: 'truyen',
        title: 'Truyện của tôi - TruyenHub',
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
