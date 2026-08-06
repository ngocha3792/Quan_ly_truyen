import { Routes } from '@angular/router';

import { authenticatedGuard } from './core/auth/authenticated.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { provideGenreDiscovery } from './features/genre-discovery/data-access/genre-discovery.providers';
import { provideHome } from './features/home/data-access/home.providers';
import { provideStoryCatalog } from './features/story-catalog/data-access/story-catalog.providers';
import { provideStoryDetail } from './features/story/data-access/story.providers';
import { provideStoryRanking } from './features/story-ranking/data-access/story-ranking.providers';
import { provideStoryUpdates } from './features/story-updates/data-access/story-updates.providers';
import { HomePageComponent } from './features/home/pages/home-page/home-page.component';
import { environment } from '../environments/environment';

export const routes: Routes = [
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
          import('./features/story/pages/story-detail/story-detail.component').then(
            (module) => module.StoryDetailComponent,
          ),
      },
      {
        path: 'danh-sach',

        title: 'Danh sách truyện - TruyenHub',

        providers: provideStoryCatalog({
          useMock: environment.storyCatalogUseMock,
        }),

        loadComponent: () =>
          import('./features/story-catalog/pages/story-catalog-page/story-catalog-page.component').then(
            (module) => module.StoryCatalogPageComponent,
          ),
      },
      {
        path: 'the-loai',

        title:
          'Thể loại truyện - TruyenHub',

        providers:
          provideGenreDiscovery({
            useMock:
              environment
                .genreDiscoveryUseMock,
          }),

        loadComponent: () =>
          import(
            './features/genre-discovery/pages/genre-discovery-page/genre-discovery-page.component'
          ).then(
            (module) =>
              module
                .GenreDiscoveryPageComponent,
          ),
      },
      {
        path: 'xep-hang',

        title:
          'Xếp hạng truyện - TruyenHub',

        providers:
          provideStoryRanking({
            useMock:
              environment
                .storyRankingUseMock,
          }),

        loadComponent: () =>
          import(
            './features/story-ranking/pages/story-ranking-page/story-ranking-page.component'
          ).then(
            (module) =>
              module
                .StoryRankingPageComponent,
          ),
      },
      {
        path: 'cap-nhat',
        title: 'Cập nhật truyện mới - TruyenHub',
        providers: provideStoryUpdates({
          useMock: environment.storyUpdatesUseMock,
        }),
        loadComponent: () =>
          import(
            './features/story-updates/pages/story-updates-page/story-updates-page.component'
          ).then(
            (module) =>
              module
                .StoryUpdatesPageComponent,
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
          import('./features/account/account.routes').then((module) => module.ACCOUNT_ROUTES),
      },

      {
        path: 'verify-email',
        title: 'XÃ¡c minh email - TruyenHub',
        loadComponent: () =>
          import('./features/auth/pages/verify-email-page/verify-email-page.component').then(
            (module) => module.VerifyEmailPageComponent,
          ),
      },
      {
        path: 'forgot-password',
        title: 'Khôi phục mật khẩu - TruyenHub',
        data: { authActionMode: 'forgot-password' },
        loadComponent: () =>
          import('./features/static/pages/coming-soon/coming-soon.component').then(
            (module) => module.ComingSoonComponent,
          ),
      },
      {
        path: 'reset-password',
        title: 'Đặt lại mật khẩu - TruyenHub',
        data: { authActionMode: 'reset-password' },
        loadComponent: () =>
          import('./features/static/pages/coming-soon/coming-soon.component').then(
            (module) => module.ComingSoonComponent,
          ),
      },
      {
        path: 'gioi-thieu',
        title: 'Giới thiệu - TruyenHub',
        loadComponent: () =>
          import(
            './features/static/pages/about-page/about-page.component'
          ).then((module) => module.AboutPageComponent),
      },
      {
        path: 'dieu-khoan',
        title: 'Điều khoản sử dụng - TruyenHub',
        loadComponent: () =>
          import(
            './features/static/pages/terms-page/terms-page.component'
          ).then((module) => module.TermsPageComponent),
      },
      {
        path: 'quyen-rieng-tu',
        title: 'Chính sách quyền riêng tư - TruyenHub',
        loadComponent: () =>
          import(
            './features/static/pages/privacy-page/privacy-page.component'
          ).then((module) => module.PrivacyPageComponent),
      },
      {
        path: 'cong-dong',
        title: 'Liên hệ hỗ trợ - TruyenHub',
        loadComponent: () =>
          import(
            './features/static/pages/support-page/support-page.component'
          ).then((module) => module.SupportPageComponent),
      },
      {
        path: 'change-email/confirm',
        title: 'Xác nhận email mới - TruyenHub',
        data: { authActionMode: 'confirm-email-change' },
        loadComponent: () =>
          import('./features/static/pages/coming-soon/coming-soon.component').then(
            (module) => module.ComingSoonComponent,
          ),
      },
      ...staticRoutes(),
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

function staticRoutes(): Routes {
  const definitions = [
    ['thu-vien', 'Thư viện', 'Quản lý thư viện truyện riêng.'],
    ['lich-su', 'Lịch sử đọc', 'Theo dõi lịch sử đọc truyện.'],
  ] as const;

  return definitions.map(([path, title, description]) => ({
    path,
    title: `${title} - TruyenHub`,
    data: {
      title,
      description,
    },
    loadComponent: () =>
      import('./features/static/pages/coming-soon/coming-soon.component').then(
        (module) => module.ComingSoonComponent,
      ),
  }));
}
