import { Routes } from '@angular/router';

export const ACCOUNT_CENTER_ROUTES: Routes = [
  {
    path: 'account',
    loadComponent: () =>
      import('./layouts/account-center-layout/account-center-layout.component').then(
        (module) => module.AccountCenterLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tổng quan tài khoản | QuanLyTruyen',
        data: {
          pageTitle: 'Tổng quan tài khoản',
          pageDescription: 'Quản lý hồ sơ, hoạt động đọc và quyền lợi thành viên.',
        },
        loadComponent: () =>
          import('./pages/overview/overview-page.component').then(
            (module) => module.AccountOverviewPageComponent,
          ),
      },
      {
        path: 'history',
        title: 'Lịch sử đọc | QuanLyTruyen',
        data: {
          pageTitle: 'Lịch sử đọc',
          pageDescription: 'Tiếp tục những nội dung bạn đã xem gần đây.',
        },
        loadComponent: () =>
          import('./pages/history/history-page.component').then(
            (module) => module.AccountHistoryPageComponent,
          ),
      },
      {
        path: 'library',
        title: 'Thư viện của tôi | QuanLyTruyen',
        data: {
          pageTitle: 'Thư viện của tôi',
          pageDescription: 'Tổ chức danh sách truyện cá nhân.',
        },
        loadComponent: () =>
          import('./pages/library/library-page.component').then(
            (module) => module.AccountLibraryPageComponent,
          ),
      },
      {
        path: 'following',
        title: 'Truyện theo dõi | QuanLyTruyen',
        data: {
          pageTitle: 'Truyện theo dõi',
          pageDescription: 'Nhận cập nhật từ các tác phẩm yêu thích.',
        },
        loadComponent: () =>
          import('./pages/following/following-page.component').then(
            (module) => module.AccountFollowingPageComponent,
          ),
      },
      {
        path: 'reviews',
        title: 'Đánh giá của tôi | QuanLyTruyen',
        data: { pageTitle: 'Đánh giá của tôi', pageDescription: 'Quản lý các đánh giá đã đăng.' },
        loadComponent: () =>
          import('./pages/reviews/reviews-page.component').then(
            (module) => module.AccountReviewsPageComponent,
          ),
      },
      {
        path: 'comments',
        title: 'Bình luận của tôi | QuanLyTruyen',
        data: {
          pageTitle: 'Bình luận của tôi',
          pageDescription: 'Theo dõi các thảo luận của bạn.',
        },
        loadComponent: () =>
          import('./pages/comments/comments-page.component').then(
            (module) => module.AccountCommentsPageComponent,
          ),
      },
      {
        path: 'profile',
        title: 'Thông tin tài khoản | QuanLyTruyen',
        data: {
          pageTitle: 'Thông tin tài khoản',
          pageDescription: 'Cập nhật hồ sơ và thông tin liên hệ.',
        },
        loadComponent: () =>
          import('./pages/profile/profile-page.component').then(
            (module) => module.AccountProfilePageComponent,
          ),
      },
      {
        path: 'security',
        title: 'Bảo mật | QuanLyTruyen',
        data: { pageTitle: 'Bảo mật', pageDescription: 'Mật khẩu, phiên đăng nhập và xác thực.' },
        loadComponent: () =>
          import('./pages/security/security-page.component').then(
            (module) => module.AccountSecurityPageComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'Thông báo | QuanLyTruyen',
        data: { pageTitle: 'Thông báo', pageDescription: 'Thiết lập kênh và loại thông báo.' },
        loadComponent: () =>
          import('./pages/notifications/notifications-page.component').then(
            (module) => module.AccountNotificationsPageComponent,
          ),
      },
      {
        path: 'transactions',
        title: 'Lịch sử giao dịch | QuanLyTruyen',
        data: {
          pageTitle: 'Lịch sử giao dịch',
          pageDescription: 'Theo dõi xu và các khoản thanh toán.',
        },
        loadComponent: () =>
          import('./pages/transactions/transactions-page.component').then(
            (module) => module.AccountTransactionsPageComponent,
          ),
      },
    ],
  },
];
