import { Routes } from '@angular/router';

export const ACCOUNT_CENTER_ROUTES: Routes = [
  {
    path: 'account',
    title: 'Tổng quan tài khoản | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/history',
    title: 'Lịch sử đọc | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/library',
    title: 'Thư viện của tôi | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/following',
    title: 'Truyện theo dõi | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/reviews',
    title: 'Đánh giá của tôi | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/comments',
    title: 'Bình luận của tôi | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/profile',
    title: 'Thông tin tài khoản | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/security',
    title: 'Bảo mật | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/notifications',
    title: 'Thông báo | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
  {
    path: 'account/transactions',
    title: 'Lịch sử giao dịch | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/account-center-page/account-center-page.component').then(
        (module) => module.AccountCenterPageComponent,
      ),
  },
];
