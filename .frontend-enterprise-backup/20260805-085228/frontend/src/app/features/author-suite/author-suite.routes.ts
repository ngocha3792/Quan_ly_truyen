import { Routes } from '@angular/router';

export const AUTHOR_SUITE_ROUTES: Routes = [
  {
    path: 'author/stories/new',
    title: 'Tạo truyện | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/stories/:id/edit',
    title: 'Chỉnh sửa truyện | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/stories/:id/chapters',
    title: 'Quản lý chương | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/stories',
    title: 'Truyện của tôi | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/analytics',
    title: 'Thống kê tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/revenue',
    title: 'Doanh thu tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/messages',
    title: 'Tin nhắn độc giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/notifications',
    title: 'Thông báo tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/profile',
    title: 'Hồ sơ tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/settings',
    title: 'Cài đặt tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/support',
    title: 'Hỗ trợ tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author/community',
    title: 'Cộng đồng tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
  {
    path: 'author',
    title: 'Tổng quan tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/author-suite-page/author-suite-page.component').then(
        (m) => m.AuthorSuitePageComponent,
      ),
  },
];
