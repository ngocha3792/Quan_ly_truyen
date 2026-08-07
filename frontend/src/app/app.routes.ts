import { Routes } from '@angular/router';

import { authenticatedGuard } from './core/auth/authenticated.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { provideGenreDiscovery } from './features/public/genre-discovery/data-access/genre-discovery.providers';
import { provideHome } from './features/public/home/data-access/home.providers';
import { provideStoryCatalog } from './features/public/story-catalog/data-access/story-catalog.providers';
import { provideStoryDetail } from './features/public/story/data-access/story.providers';
import { provideStoryRanking } from './features/public/story-ranking/data-access/story-ranking.providers';
import { provideStoryUpdates } from './features/public/story-updates/data-access/story-updates.providers';
import { HomePageComponent } from './features/public/home/pages/home-page/home-page.component';
import { environment } from '../environments/environment';

export const routes: Routes = [
  {
    path: 'author-studio',

    loadComponent: () =>
      import('./features/author-portal/author-studio/pages/author-studio-shell/author-studio-shell.component').then(
        (module) => module.AuthorStudioShellComponent,
      ),

    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tong-quan',
      },

      {
        path: 'tong-quan',
        title: 'Tổng quan tác giả - TruyenHub',

        loadComponent: () =>
          import('./features/author-portal/author-studio/pages/author-dashboard-page/author-dashboard-page.component').then(
            (module) => module.AuthorDashboardPageComponent,
          ),
      },

      /*
       * Các module chưa làm sẽ tạm quay về tổng quan.
       * Khi làm từng trang thì thay từng route riêng.
       */
      {
        path: '**',
        redirectTo: 'tong-quan',
      },
    ],
  },
  {
    path: '',
    component: AppShellComponent,

    // HomeRepository phải nằm ở route cha vì AppHeaderComponent cũng sử dụng nó.
    providers: provideHome({
      useMock: true,
    }),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'TruyenHub - Đọc truyện online',

        // Import trực tiếp thay vì lazy-load.
        component: HomePageComponent,
      },
      {
        path: 'truyen/:slug',
        title: 'Chi tiết truyện - TruyenHub',
        providers: provideStoryDetail({
          useMock: true,
        }),
        loadComponent: () =>
          import('./features/public/story/pages/story-detail/story-detail.component').then(
            (module) => module.StoryDetailComponent,
          ),
      },
      {
        path: 'truyen/:storySlug/chuong/:chapterNumber',
        title: 'Đọc chương - TruyenHub',
        loadComponent: () =>
          import('./features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component').then(
            (module) => module.ChapterReaderPageComponent,
          ),
      },
      {
        path: 'danh-sach',

        title: 'Danh sách truyện - TruyenHub',

        providers: provideStoryCatalog({
          useMock: environment.storyCatalogUseMock,
        }),

        loadComponent: () =>
          import('./features/public/story-catalog/pages/story-catalog-page/story-catalog-page.component').then(
            (module) => module.StoryCatalogPageComponent,
          ),
      },
      {
        path: 'the-loai',

        title: 'Thể loại truyện - TruyenHub',

        providers: provideGenreDiscovery({
          useMock: environment.genreDiscoveryUseMock,
        }),

        loadComponent: () =>
          import('./features/public/genre-discovery/pages/genre-discovery-page/genre-discovery-page.component').then(
            (module) => module.GenreDiscoveryPageComponent,
          ),
      },
      {
        path: 'xep-hang',

        title: 'Xếp hạng truyện - TruyenHub',

        providers: provideStoryRanking({
          useMock: environment.storyRankingUseMock,
        }),

        loadComponent: () =>
          import('./features/public/story-ranking/pages/story-ranking-page/story-ranking-page.component').then(
            (module) => module.StoryRankingPageComponent,
          ),
      },
      {
        path: 'cap-nhat',
        title: 'Cập nhật truyện mới - TruyenHub',
        providers: provideStoryUpdates({
          useMock: environment.storyUpdatesUseMock,
        }),
        loadComponent: () =>
          import('./features/public/story-updates/pages/story-updates-page/story-updates-page.component').then(
            (module) => module.StoryUpdatesPageComponent,
          ),
      },
      /*
       * Toàn bộ trang tài khoản phải đi qua
       * ACCOUNT_ROUTES và AccountLayoutComponent.
       */
      {
        path: 'tai-khoan',
        canActivate: [authenticatedGuard],
        loadChildren: () =>
          import('./features/account/profile/account.routes').then(
            (module) => module.ACCOUNT_ROUTES,
          ),
      },

      {
        path: 'verify-email',
        title: 'Xác minh email - TruyenHub',
        loadComponent: () =>
          import('./features/account/auth/pages/verify-email-page/verify-email-page.component').then(
            (module) => module.VerifyEmailPageComponent,
          ),
      },
      {
        path: 'oauth/callback',

        title: 'Đang đăng nhập - TruyenHub',

        loadComponent: () =>
          import('./features/account/auth/pages/oauth-callback-page/oauth-callback-page.component').then(
            (module) => module.OAuthCallbackPageComponent,
          ),
      },
      {
        path: 'forgot-password',
        title: 'Khôi phục mật khẩu - TruyenHub',
        data: { authActionMode: 'forgot-password' },
        loadComponent: () =>
          import('./features/account/forgot-password/pages/forgot-password-page/forgot-password-page.component').then(
            (module) => module.ForgotPasswordPageComponent,
          ),
      },
      {
        path: 'reset-password',
        title: 'Tạo mật khẩu mới - TruyenHub',

        loadComponent: () =>
          import('./features/account/reset-password/pages/reset-password-page/reset-password-page.component').then(
            (module) => module.ResetPasswordPageComponent,
          ),
      },
      {
        path: 'change-email/confirm',
        title: 'Xác nhận email mới - TruyenHub',
        data: { authActionMode: 'confirm-email-change' },
        loadComponent: () =>
          import('./features/account/email-confirmation/pages/email-confirmation-page/email-confirmation-page.component').then(
            (module) => module.EmailConfirmationPageComponent,
          ),
      },
      {
        path: 'gioi-thieu',
        title: 'Giới thiệu - TruyenHub',
        loadComponent: () =>
          import('./features/public/static/pages/about-page/about-page.component').then(
            (module) => module.AboutPageComponent,
          ),
      },
      {
        path: 'dieu-khoan',
        title: 'Điều khoản sử dụng - TruyenHub',
        loadComponent: () =>
          import('./features/public/static/pages/terms-page/terms-page.component').then(
            (module) => module.TermsPageComponent,
          ),
      },
      {
        path: 'quyen-rieng-tu',
        title: 'Chính sách quyền riêng tư - TruyenHub',
        loadComponent: () =>
          import('./features/public/static/pages/privacy-page/privacy-page.component').then(
            (module) => module.PrivacyPageComponent,
          ),
      },
      {
        path: 'cong-dong',
        title: 'Liên hệ hỗ trợ - TruyenHub',
        loadComponent: () =>
          import('./features/public/static/pages/support-page/support-page.component').then(
            (module) => module.SupportPageComponent,
          ),
      },
      {
        path: 'tac-gia',
        title: 'Tác giả nổi bật - TruyenHub',

        loadComponent: () =>
          import('./features/public/author-directory/pages/author-directory-page/author-directory-page.component').then(
            (module) => module.AuthorDirectoryPageComponent,
          ),
      },
      {
        path: 'tac-gia/:authorSlug',
        title: 'Chi tiết tác giả - TruyenHub',

        loadComponent: () =>
          import('./features/public/author-detail/pages/author-detail-page/author-detail-page.component').then(
            (module) => module.AuthorDetailPageComponent,
          ),
      },
      {
        path: 'lich-su',
        title: 'Lịch sử đọc - TruyenHub',

        loadComponent: () =>
          import('./features/account/reading-history/pages/reading-history-page/reading-history-page.component').then(
            (module) => module.ReadingHistoryPageComponent,
          ),
      },
      {
        path: 'thong-bao',
        title: 'Thông báo - TruyenHub',

        loadComponent: () =>
          import('./features/account/notifications/pages/notifications-page/notifications-page.component').then(
            (module) => module.NotificationsPageComponent,
          ),
      },
      {
        path: 'thu-vien',
        title: 'Thư viện của tôi - TruyenHub',

        loadComponent: () =>
          import('./features/account/my-library/pages/my-library-page/my-library-page.component').then(
            (module) => module.MyLibraryPageComponent,
          ),
      },
      {
        path: 'dang-ky-tac-gia',
        title: 'Trở thành tác giả - TruyenHub',

        loadComponent: () =>
          import('./features/account/author-application/pages/author-application-page/author-application-page.component').then(
            (module) => module.AuthorApplicationPageComponent,
          ),
      },
      {
        path: 'tac-gia-studio',
        title: 'Studio Tác giả - TruyenHub',

        loadComponent: () =>
          import('./features/author-portal/author-studio/pages/author-studio-shell/author-studio-shell.component').then(
            (module) => module.AuthorStudioShellComponent,
          ),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/author-portal/author-studio/pages/author-dashboard-page/author-dashboard-page.component').then(
                (m) => m.AuthorDashboardPageComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
