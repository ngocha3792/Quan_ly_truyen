import { Routes } from '@angular/router';

export const AUTHOR_SUITE_ROUTES: Routes = [
  {
    path: 'author',
    loadComponent: () =>
      import('./layouts/author-suite-layout/author-suite-layout.component').then(
        (module) => module.AuthorSuiteLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tổng quan tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Tổng quan tác giả',
          pageDescription: 'Hiệu suất nội dung và hoạt động gần đây.',
        },
        loadComponent: () =>
          import('./pages/overview/overview-page.component').then(
            (module) => module.AuthorOverviewPageComponent,
          ),
      },
      {
        path: 'stories',
        title: 'Truyện của tôi | QuanLyTruyen',
        data: {
          pageTitle: 'Truyện của tôi',
          pageDescription: 'Quản lý toàn bộ tác phẩm đang phát hành.',
        },
        loadComponent: () =>
          import('./pages/stories/stories-page.component').then(
            (module) => module.AuthorStoriesPageComponent,
          ),
      },
      {
        path: 'stories/new',
        title: 'Tạo truyện | QuanLyTruyen',
        data: {
          pageTitle: 'Tạo / Chỉnh sửa truyện',
          pageDescription: 'Biên tập thông tin và nội dung tác phẩm.',
        },
        loadComponent: () =>
          import('./pages/editor/editor-page.component').then(
            (module) => module.AuthorEditorPageComponent,
          ),
      },
      {
        path: 'stories/:id/edit',
        title: 'Chỉnh sửa truyện | QuanLyTruyen',
        data: {
          pageTitle: 'Tạo / Chỉnh sửa truyện',
          pageDescription: 'Biên tập thông tin và nội dung tác phẩm.',
        },
        loadComponent: () =>
          import('./pages/editor/editor-page.component').then(
            (module) => module.AuthorEditorPageComponent,
          ),
      },
      {
        path: 'stories/:id/chapters',
        title: 'Quản lý chương | QuanLyTruyen',
        data: {
          pageTitle: 'Quản lý chương',
          pageDescription: 'Lập lịch, chỉnh sửa và xuất bản chương.',
        },
        loadComponent: () =>
          import('./pages/chapters/chapters-page.component').then(
            (module) => module.AuthorChaptersPageComponent,
          ),
      },
      {
        path: 'analytics',
        title: 'Thống kê tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Thống kê chi tiết',
          pageDescription: 'Phân tích lượt đọc và tăng trưởng độc giả.',
        },
        loadComponent: () =>
          import('./pages/analytics/analytics-page.component').then(
            (module) => module.AuthorAnalyticsPageComponent,
          ),
      },
      {
        path: 'revenue',
        title: 'Doanh thu tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Doanh thu',
          pageDescription: 'Theo dõi thu nhập và lịch sử thanh toán.',
        },
        loadComponent: () =>
          import('./pages/revenue/revenue-page.component').then(
            (module) => module.AuthorRevenuePageComponent,
          ),
      },
      {
        path: 'messages',
        title: 'Tin nhắn độc giả | QuanLyTruyen',
        data: {
          pageTitle: 'Tin nhắn độc giả',
          pageDescription: 'Trao đổi với cộng đồng người đọc.',
        },
        loadComponent: () =>
          import('./pages/messages/messages-page.component').then(
            (module) => module.AuthorMessagesPageComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'Thông báo tác giả | QuanLyTruyen',
        data: { pageTitle: 'Thông báo', pageDescription: 'Các cập nhật quan trọng cho tác giả.' },
        loadComponent: () =>
          import('./pages/notifications/notifications-page.component').then(
            (module) => module.AuthorNotificationsPageComponent,
          ),
      },
      {
        path: 'profile',
        title: 'Hồ sơ tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Hồ sơ tác giả',
          pageDescription: 'Quản lý thông tin công khai của tác giả.',
        },
        loadComponent: () =>
          import('./pages/profile/profile-page.component').then(
            (module) => module.AuthorProfilePageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Cài đặt tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Cài đặt',
          pageDescription: 'Thiết lập tài khoản và tùy chọn làm việc.',
        },
        loadComponent: () =>
          import('./pages/settings/settings-page.component').then(
            (module) => module.AuthorSettingsPageComponent,
          ),
      },
      {
        path: 'support',
        title: 'Hỗ trợ tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Trung tâm hỗ trợ',
          pageDescription: 'Tài liệu và kênh hỗ trợ vận hành.',
        },
        loadComponent: () =>
          import('./pages/support/support-page.component').then(
            (module) => module.AuthorSupportPageComponent,
          ),
      },
      {
        path: 'community',
        title: 'Cộng đồng tác giả | QuanLyTruyen',
        data: {
          pageTitle: 'Cộng đồng tác giả',
          pageDescription: 'Kết nối và chia sẻ kinh nghiệm sáng tác.',
        },
        loadComponent: () =>
          import('./pages/community/community-page.component').then(
            (module) => module.AuthorCommunityPageComponent,
          ),
      },
    ],
  },
];
