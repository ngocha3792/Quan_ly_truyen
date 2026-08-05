import { Routes } from '@angular/router';

export const PUBLIC_SITE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'QuanLyTruyen - Đọc truyện online',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'genres',
    title: 'Thể loại truyện | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'search',
    title: 'Tìm kiếm truyện | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'rankings',
    title: 'Bảng xếp hạng | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'story/:slug/chapters',
    title: 'Danh sách chương | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'story/:slug/chapter/:chapter/comments',
    title: 'Bình luận chương | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'read/:slug/:chapter',
    title: 'Đọc truyện | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'authors/:slug',
    title: 'Tác giả | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'about',
    title: 'Giới thiệu | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'guide',
    title: 'Hướng dẫn | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: '404',
    title: 'Không tìm thấy trang | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
  {
    path: 'story/:slug',
    title: 'Chi tiết truyện | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/public-site-page/public-site-page.component').then(
        (module) => module.PublicSitePageComponent,
      ),
  },
];
