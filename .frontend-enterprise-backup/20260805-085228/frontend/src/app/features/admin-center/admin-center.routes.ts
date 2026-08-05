import { Routes } from '@angular/router';

export const ADMIN_CENTER_ROUTES: Routes = [
  {
    path: 'dashboard',
    title: 'Dashboard | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin',
    title: 'Dashboard | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/stories',
    title: 'Quản lý truyện | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/stories/:id/chapters',
    title: 'Quản lý chương | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/users',
    title: 'Quản lý người dùng | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/authors',
    title: 'Quản lý tác giả | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/comments',
    title: 'Quản lý bình luận | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/reports',
    title: 'Quản lý báo cáo | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/categories',
    title: 'Quản lý danh mục | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/transactions',
    title: 'Quản lý giao dịch | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/ads',
    title: 'Quản lý quảng cáo | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/settings',
    title: 'Cấu hình hệ thống | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
  {
    path: 'admin/activity-logs',
    title: 'Nhật ký hoạt động | QuanLyTruyen Admin',
    loadComponent: () =>
      import('./pages/admin-center-page/admin-center-page.component').then(
        (module) => module.AdminCenterPageComponent,
      ),
  },
];
