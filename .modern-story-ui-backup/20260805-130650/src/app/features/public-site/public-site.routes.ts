import { Routes } from '@angular/router';

export const PUBLIC_SITE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-site-layout/public-site-layout.component').then(
        (module) => module.PublicSiteLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'QuanLyTruyen - Đọc truyện online',
        data: { pageTitle: 'Trang chủ' },
        loadComponent: () =>
          import('./pages/home/home-page.component').then(
            (module) => module.PublicHomePageComponent,
          ),
      },
      {
        path: 'genres',
        title: 'Thể loại truyện | QuanLyTruyen',
        data: { pageTitle: 'Thể loại' },
        loadComponent: () =>
          import('./pages/genres/genres-page.component').then(
            (module) => module.PublicGenresPageComponent,
          ),
      },
      {
        path: 'search',
        title: 'Tìm kiếm truyện | QuanLyTruyen',
        data: { pageTitle: 'Tìm kiếm' },
        loadComponent: () =>
          import('./pages/search/search-page.component').then(
            (module) => module.PublicSearchPageComponent,
          ),
      },
      {
        path: 'rankings',
        title: 'Bảng xếp hạng | QuanLyTruyen',
        data: { pageTitle: 'Xếp hạng' },
        loadComponent: () =>
          import('./pages/rankings/rankings-page.component').then(
            (module) => module.PublicRankingsPageComponent,
          ),
      },
      {
        path: 'story/:slug/chapters',
        title: 'Danh sách chương | QuanLyTruyen',
        data: { pageTitle: 'Danh sách chương' },
        loadComponent: () =>
          import('./pages/chapters/chapters-page.component').then(
            (module) => module.PublicChaptersPageComponent,
          ),
      },
      {
        path: 'story/:slug/chapter/:chapter/comments',
        title: 'Bình luận chương | QuanLyTruyen',
        data: { pageTitle: 'Bình luận' },
        loadComponent: () =>
          import('./pages/comments/comments-page.component').then(
            (module) => module.PublicCommentsPageComponent,
          ),
      },
      {
        path: 'read/:slug/:chapter',
        title: 'Đọc truyện | QuanLyTruyen',
        data: { pageTitle: 'Đọc truyện', pageClass: 'reader-page' },
        loadComponent: () =>
          import('./pages/reader/reader-page.component').then(
            (module) => module.PublicReaderPageComponent,
          ),
      },
      {
        path: 'authors/:slug',
        title: 'Tác giả | QuanLyTruyen',
        data: { pageTitle: 'Tác giả' },
        loadComponent: () =>
          import('./pages/author/author-page.component').then(
            (module) => module.PublicAuthorPageComponent,
          ),
      },
      {
        path: 'about',
        title: 'Giới thiệu | QuanLyTruyen',
        data: { pageTitle: 'Giới thiệu' },
        loadComponent: () =>
          import('./pages/about/about-page.component').then(
            (module) => module.PublicAboutPageComponent,
          ),
      },
      {
        path: 'guide',
        title: 'Hướng dẫn | QuanLyTruyen',
        data: { pageTitle: 'Hướng dẫn' },
        loadComponent: () =>
          import('./pages/guide/guide-page.component').then(
            (module) => module.PublicGuidePageComponent,
          ),
      },
      {
        path: '404',
        title: 'Không tìm thấy trang | QuanLyTruyen',
        data: { pageTitle: 'Không tìm thấy trang', hideChrome: true, pageClass: 'not-found-page' },
        loadComponent: () =>
          import('./pages/notfound/notfound-page.component').then(
            (module) => module.PublicNotFoundPageComponent,
          ),
      },
      {
        path: 'story/:slug',
        title: 'Chi tiết truyện | QuanLyTruyen',
        data: { pageTitle: 'Chi tiết truyện' },
        loadComponent: () =>
          import('./pages/story/story-page.component').then(
            (module) => module.PublicStoryPageComponent,
          ),
      },
    ],
  },
];
