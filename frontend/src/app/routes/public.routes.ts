import { Routes } from '@angular/router';
import {
  APP_DEFAULT_PAGE_TITLE,
  APP_NAME,
  appPageTitle,
} from '../core/config/app-identity.constants';

import { provideChapterReader } from '../features/public/chapter-reader/data-access/chapter-reader.providers';
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
    title: APP_DEFAULT_PAGE_TITLE,
    data: {
      seoDescription: `Đọc truyện online, khám phá truyện mới cập nhật, bảng xếp hạng và thư viện truyện nổi bật tại ${APP_NAME}.`,
    },
    component: HomePageComponent,
  },
  {
    path: 'truyen/:slug',
    title: appPageTitle('Chi tiết truyện'),
    data: {
      seoDescription: `Thông tin truyện, tác giả, chương mới nhất, đánh giá và nội dung liên quan trên ${APP_NAME}.`,
    },
    providers: provideStoryDetail(),
    loadComponent: () =>
      import('../features/public/story/pages/story-detail/story-detail.component').then(
        (module) => module.StoryDetailComponent,
      ),
  },
  {
    path: 'truyen/:storySlug/chuong/:chapterNumber',
    title: appPageTitle('Đọc chương'),
    data: {
      seoDescription: `Đọc chương truyện online với chế độ đọc tối ưu trên ${APP_NAME}.`,
    },
    providers: provideChapterReader(),
    loadComponent: () =>
      import('../features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component').then(
        (module) => module.ChapterReaderPageComponent,
      ),
  },
  {
    path: 'danh-sach',
    title: appPageTitle('Danh sách truyện'),
    data: {
      seoDescription: `Duyệt danh sách truyện theo từ khóa, thể loại, trạng thái và mức độ phổ biến trên ${APP_NAME}.`,
    },
    providers: provideStoryCatalog(),
    loadComponent: () =>
      import('../features/public/story-catalog/pages/story-catalog-page/story-catalog-page.component').then(
        (module) => module.StoryCatalogPageComponent,
      ),
  },
  {
    path: 'the-loai',
    title: appPageTitle('Thể loại truyện'),
    data: {
      seoDescription: `Khám phá truyện theo thể loại và tìm các chủ đề đọc phù hợp trên ${APP_NAME}.`,
    },
    providers: provideGenreDiscovery(),
    loadComponent: () =>
      import('../features/public/genre-discovery/pages/genre-discovery-page/genre-discovery-page.component').then(
        (module) => module.GenreDiscoveryPageComponent,
      ),
  },
  {
    path: 'xep-hang',
    title: appPageTitle('Xếp hạng truyện'),
    data: {
      seoDescription: `Bảng xếp hạng truyện nổi bật theo lượt đọc, đánh giá và xu hướng trên ${APP_NAME}.`,
    },
    providers: provideStoryRanking(),
    loadComponent: () =>
      import('../features/public/story-ranking/pages/story-ranking-page/story-ranking-page.component').then(
        (module) => module.StoryRankingPageComponent,
      ),
  },
  {
    path: 'cap-nhat',
    title: appPageTitle('Cập nhật truyện mới'),
    data: {
      seoDescription: `Theo dõi các truyện và chương mới được cập nhật gần đây trên ${APP_NAME}.`,
    },
    providers: provideStoryUpdates(),
    loadComponent: () =>
      import('../features/public/story-updates/pages/story-updates-page/story-updates-page.component').then(
        (module) => module.StoryUpdatesPageComponent,
      ),
  },
  {
    path: 'gioi-thieu',
    title: appPageTitle('Giới thiệu'),
    data: {
      seoDescription: `Tìm hiểu về ${APP_NAME} và trải nghiệm đọc, quản lý truyện trên nền tảng.`,
    },
    loadComponent: () =>
      import('../features/public/static/pages/about-page/about-page.component').then(
        (module) => module.AboutPageComponent,
      ),
  },
  {
    path: 'dieu-khoan',
    title: appPageTitle('Điều khoản sử dụng'),
    data: {
      seoDescription: `Điều khoản sử dụng dịch vụ và các nguyên tắc áp dụng khi sử dụng ${APP_NAME}.`,
    },
    loadComponent: () =>
      import('../features/public/static/pages/terms-page/terms-page.component').then(
        (module) => module.TermsPageComponent,
      ),
  },
  {
    path: 'quyen-rieng-tu',
    title: appPageTitle('Chính sách quyền riêng tư'),
    data: {
      seoDescription: `Chính sách quyền riêng tư và cách ${APP_NAME} xử lý dữ liệu người dùng.`,
    },
    loadComponent: () =>
      import('../features/public/static/pages/privacy-page/privacy-page.component').then(
        (module) => module.PrivacyPageComponent,
      ),
  },
  {
    path: 'cong-dong',
    title: appPageTitle('Liên hệ hỗ trợ'),
    data: {
      seoDescription: `Thông tin hỗ trợ và các kênh liên hệ dành cho người dùng ${APP_NAME}.`,
    },
    loadComponent: () =>
      import('../features/public/static/pages/support-page/support-page.component').then(
        (module) => module.SupportPageComponent,
      ),
  },
  {
    path: 'tac-gia',
    title: appPageTitle('Tác giả nổi bật'),
    data: {
      seoDescription: `Khám phá tác giả và các tác phẩm nổi bật đang được xuất bản trên ${APP_NAME}.`,
    },
    loadComponent: () =>
      import('../features/public/author-directory/pages/author-directory-page/author-directory-page.component').then(
        (module) => module.AuthorDirectoryPageComponent,
      ),
  },
  {
    path: 'tac-gia/:authorSlug',
    title: appPageTitle('Chi tiết tác giả'),
    data: {
      seoDescription: `Thông tin tác giả, tiểu sử và danh sách tác phẩm được xuất bản trên ${APP_NAME}.`,
    },
    loadComponent: () =>
      import('../features/public/author-detail/pages/author-detail-page/author-detail-page.component').then(
        (module) => module.AuthorDetailPageComponent,
      ),
  },
];
