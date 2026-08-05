import { Routes } from '@angular/router';

import { authenticatedGuard } from './core/auth/authenticated.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'TruyenHub - Đọc truyện online',
        loadComponent: () =>
          import(
            './features/home/pages/home-page/home-page.component'
          ).then(
            (module) => module.HomePageComponent,
          ),
      },
      {
        path: 'truyen/:slug',
        title: 'Chi tiết truyện - TruyenHub',
        loadComponent: () =>
          import(
            './features/story/pages/story-detail/story-detail.component'
          ).then(
            (module) => module.StoryDetailComponent,
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
          import(
            './features/account/account.routes'
          ).then(
            (module) => module.ACCOUNT_ROUTES,
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
    [
      'danh-sach',
      'Danh sách truyện',
      'Khám phá toàn bộ danh sách truyện.',
    ],
    [
      'the-loai',
      'Thể loại',
      'Khám phá truyện theo thể loại.',
    ],
    [
      'xep-hang',
      'Xếp hạng',
      'Bảng xếp hạng truyện.',
    ],
    [
      'cap-nhat',
      'Cập nhật mới',
      'Các truyện vừa cập nhật.',
    ],
    [
      'thu-vien',
      'Thư viện',
      'Quản lý thư viện truyện riêng.',
    ],
    [
      'lich-su',
      'Lịch sử đọc',
      'Theo dõi lịch sử đọc truyện.',
    ],
    [
      'gioi-thieu',
      'Giới thiệu',
      'Thông tin về TruyenHub.',
    ],
    [
      'dieu-khoan',
      'Điều khoản sử dụng',
      'Điều khoản sử dụng dịch vụ.',
    ],
    [
      'quyen-rieng-tu',
      'Quyền riêng tư',
      'Chính sách quyền riêng tư.',
    ],
  ] as const;

  return definitions.map(
    ([path, title, description]) => ({
      path,
      title: `${title} - TruyenHub`,
      data: {
        title,
        description,
      },
      loadComponent: () =>
        import(
          './features/static/pages/coming-soon/coming-soon.component'
        ).then(
          (module) => module.ComingSoonComponent,
        ),
    }),
  );
}