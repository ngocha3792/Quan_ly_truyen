import { Routes } from '@angular/router';

import { environment } from '../../environments/environment';
import { provideGenreDiscovery } from '../features/public/genre-discovery/data-access/genre-discovery.providers';
import { HomePageComponent } from '../features/public/home/pages/home-page/home-page.component';
import { provideStoryCatalog } from '../features/public/story-catalog/data-access/story-catalog.providers';
import { provideStoryRanking } from '../features/public/story-ranking/data-access/story-ranking.providers';
import { provideStoryUpdates } from '../features/public/story-updates/data-access/story-updates.providers';
import { provideStoryDetail } from '../features/public/story/data-access/story.providers';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'TruyenHub - Đọc truyện online',
    component: HomePageComponent,
  },
  {
    path: 'truyen/:slug',
    title: 'Chi tiết truyện - TruyenHub',
    providers: provideStoryDetail({ useMock: true }),
    loadComponent: () =>
      import('../features/public/story/pages/story-detail/story-detail.component').then(
        (module) => module.StoryDetailComponent,
      ),
  },
  {
    path: 'truyen/:storySlug/chuong/:chapterNumber',
    title: 'Đọc chương - TruyenHub',
    loadComponent: () =>
      import('../features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component').then(
        (module) => module.ChapterReaderPageComponent,
      ),
  },
  {
    path: 'danh-sach',
    title: 'Danh sách truyện - TruyenHub',
    providers: provideStoryCatalog({ useMock: environment.storyCatalogUseMock }),
    loadComponent: () =>
      import('../features/public/story-catalog/pages/story-catalog-page/story-catalog-page.component').then(
        (module) => module.StoryCatalogPageComponent,
      ),
  },
  {
    path: 'the-loai',
    title: 'Thể loại truyện - TruyenHub',
    providers: provideGenreDiscovery({ useMock: environment.genreDiscoveryUseMock }),
    loadComponent: () =>
      import('../features/public/genre-discovery/pages/genre-discovery-page/genre-discovery-page.component').then(
        (module) => module.GenreDiscoveryPageComponent,
      ),
  },
  {
    path: 'xep-hang',
    title: 'Xếp hạng truyện - TruyenHub',
    providers: provideStoryRanking({ useMock: environment.storyRankingUseMock }),
    loadComponent: () =>
      import('../features/public/story-ranking/pages/story-ranking-page/story-ranking-page.component').then(
        (module) => module.StoryRankingPageComponent,
      ),
  },
  {
    path: 'cap-nhat',
    title: 'Cập nhật truyện mới - TruyenHub',
    providers: provideStoryUpdates({ useMock: environment.storyUpdatesUseMock }),
    loadComponent: () =>
      import('../features/public/story-updates/pages/story-updates-page/story-updates-page.component').then(
        (module) => module.StoryUpdatesPageComponent,
      ),
  },
  {
    path: 'gioi-thieu',
    title: 'Giới thiệu - TruyenHub',
    loadComponent: () =>
      import('../features/public/static/pages/about-page/about-page.component').then(
        (module) => module.AboutPageComponent,
      ),
  },
  {
    path: 'dieu-khoan',
    title: 'Điều khoản sử dụng - TruyenHub',
    loadComponent: () =>
      import('../features/public/static/pages/terms-page/terms-page.component').then(
        (module) => module.TermsPageComponent,
      ),
  },
  {
    path: 'quyen-rieng-tu',
    title: 'Chính sách quyền riêng tư - TruyenHub',
    loadComponent: () =>
      import('../features/public/static/pages/privacy-page/privacy-page.component').then(
        (module) => module.PrivacyPageComponent,
      ),
  },
  {
    path: 'cong-dong',
    title: 'Liên hệ hỗ trợ - TruyenHub',
    loadComponent: () =>
      import('../features/public/static/pages/support-page/support-page.component').then(
        (module) => module.SupportPageComponent,
      ),
  },
  {
    path: 'tac-gia',
    title: 'Tác giả nổi bật - TruyenHub',
    loadComponent: () =>
      import('../features/public/author-directory/pages/author-directory-page/author-directory-page.component').then(
        (module) => module.AuthorDirectoryPageComponent,
      ),
  },
  {
    path: 'tac-gia/:authorSlug',
    title: 'Chi tiết tác giả - TruyenHub',
    loadComponent: () =>
      import('../features/public/author-detail/pages/author-detail-page/author-detail-page.component').then(
        (module) => module.AuthorDetailPageComponent,
      ),
  },
];
