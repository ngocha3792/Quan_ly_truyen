import { Routes } from '@angular/router';

const loadLayout = () =>
  import('./layouts/admin-center-layout/admin-center-layout.component').then(
    (module) => module.AdminCenterLayoutComponent,
  );

export const ADMIN_CENTER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: loadLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Dashboard | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Tổng quan',
          pageDescription: 'Chào mừng trở lại, đây là tình hình hệ thống hôm nay.',
        },
        loadComponent: () =>
          import('./pages/overview/overview-page.component').then(
            (module) => module.AdminOverviewPageComponent,
          ),
      },
    ],
  },
  {
    path: 'admin',
    loadComponent: loadLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Dashboard | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Tổng quan',
          pageDescription: 'Chào mừng trở lại, đây là tình hình hệ thống hôm nay.',
        },
        loadComponent: () =>
          import('./pages/overview/overview-page.component').then(
            (module) => module.AdminOverviewPageComponent,
          ),
      },
      {
        path: 'stories',
        title: 'Quản lý truyện | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý truyện',
          pageDescription: 'Kiểm duyệt và vận hành kho truyện.',
        },
        loadComponent: () =>
          import('./pages/stories/stories-page.component').then(
            (module) => module.AdminStoriesPageComponent,
          ),
      },
      {
        path: 'stories/:id/chapters',
        title: 'Quản lý chương | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý chương',
          pageDescription: 'Theo dõi trạng thái xuất bản từng chương.',
        },
        loadComponent: () =>
          import('./pages/chapters/chapters-page.component').then(
            (module) => module.AdminChaptersPageComponent,
          ),
      },
      {
        path: 'users',
        title: 'Quản lý người dùng | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý người dùng',
          pageDescription: 'Tài khoản, vai trò và trạng thái hoạt động.',
        },
        loadComponent: () =>
          import('./pages/users/users-page.component').then(
            (module) => module.AdminUsersPageComponent,
          ),
      },
      {
        path: 'authors',
        title: 'Quản lý tác giả | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý tác giả',
          pageDescription: 'Hồ sơ và hiệu suất cộng tác viên.',
        },
        loadComponent: () =>
          import('./pages/authors/authors-page.component').then(
            (module) => module.AdminAuthorsPageComponent,
          ),
      },
      {
        path: 'comments',
        title: 'Quản lý bình luận | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý bình luận',
          pageDescription: 'Kiểm duyệt thảo luận cộng đồng.',
        },
        loadComponent: () =>
          import('./pages/comments/comments-page.component').then(
            (module) => module.AdminCommentsPageComponent,
          ),
      },
      {
        path: 'reports',
        title: 'Quản lý báo cáo | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý báo cáo',
          pageDescription: 'Xử lý các nội dung được người dùng báo cáo.',
        },
        loadComponent: () =>
          import('./pages/reports/reports-page.component').then(
            (module) => module.AdminReportsPageComponent,
          ),
      },
      {
        path: 'categories',
        title: 'Quản lý danh mục | QuanLyTruyen Admin',
        data: { pageTitle: 'Quản lý danh mục', pageDescription: 'Chuẩn hóa taxonomy và thể loại.' },
        loadComponent: () =>
          import('./pages/categories/categories-page.component').then(
            (module) => module.AdminCategoriesPageComponent,
          ),
      },
      {
        path: 'transactions',
        title: 'Quản lý giao dịch | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý giao dịch',
          pageDescription: 'Đối soát dòng tiền trên nền tảng.',
        },
        loadComponent: () =>
          import('./pages/transactions/transactions-page.component').then(
            (module) => module.AdminTransactionsPageComponent,
          ),
      },
      {
        path: 'ads',
        title: 'Quản lý quảng cáo | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Quản lý quảng cáo',
          pageDescription: 'Lịch chạy và vị trí hiển thị quảng cáo.',
        },
        loadComponent: () =>
          import('./pages/ads/ads-page.component').then((module) => module.AdminAdsPageComponent),
      },
      {
        path: 'settings',
        title: 'Cấu hình hệ thống | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Cấu hình hệ thống',
          pageDescription: 'Thiết lập vận hành toàn hệ thống.',
        },
        loadComponent: () =>
          import('./pages/settings/settings-page.component').then(
            (module) => module.AdminSettingsPageComponent,
          ),
      },
      {
        path: 'activity-logs',
        title: 'Nhật ký hoạt động | QuanLyTruyen Admin',
        data: {
          pageTitle: 'Nhật ký hoạt động',
          pageDescription: 'Theo dõi các thay đổi quan trọng.',
        },
        loadComponent: () =>
          import('./pages/activity/activity-page.component').then(
            (module) => module.AdminActivityPageComponent,
          ),
      },
    ],
  },
];
