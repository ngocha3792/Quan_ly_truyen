import { Routes } from '@angular/router';

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
    title: 'TruyenHub - Đọc truyện online',
    data: { seoDescription: 'Đọc truyện online, khám phá truyện mới cập nhật, bảng xếp hạng và thư viện truyện nổi bật tại TruyenHub.' },
    component: HomePageComponent,
  },
  {
    path: 'truyen/:slug',
    title: 'Chi tiết truyện - TruyenHub',
    data: { seoDescription: 'Thông tin truyện, tác giả, chương mới nhất, đánh giá và nội dung liên quan trên TruyenHub.' },
    providers: provideStoryDetail(),
    loadComponent: () =>
      import('../features/public/story/pages/story-detail/story-detail.component').then(
        (module) => module.StoryDetailComponent,
      ),
  },
  {
    path: 'truyen/:storySlug/chuong/:chapterNumber',
    title: 'Đọc chương - TruyenHub',
    data: { seoDescription: 'Đọc chương truyện online với chế độ đọc tối ưu trên TruyenHub.' },
    providers: provideChapterReader(),
    loadComponent: () =>
      import('../features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component').then(
        (module) => module.ChapterReaderPageComponent,
      ),
  },
  {
    path: 'danh-sach',
    title: 'Danh sách truyện - TruyenHub',
    data: { seoDescription: 'Duyệt danh sách truyện theo từ khóa, thể loại, trạng thái và mức độ phổ biến trên TruyenHub.' },
    providers: provideStoryCatalog(),
    loadComponent: () =>
      import('../features/public/story-catalog/pages/story-catalog-page/story-catalog-page.component').then(
        (module) => module.StoryCatalogPageComponent,
      ),
  },
  {
    path: 'the-loai',
    title: 'Thể loại truyện - TruyenHub',
    data: { seoDescription: 'Khám phá truyện theo thể loại và tìm các chủ đề đọc phù hợp trên TruyenHub.' },
    providers: provideGenreDiscovery(),
    loadComponent: () =>
      import('../features/public/genre-discovery/pages/genre-discovery-page/genre-discovery-page.component').then(
        (module) => module.GenreDiscoveryPageComponent,
      ),
  },
  {
    path: 'xep-hang',
    title: 'Xếp hạng truyện - TruyenHub',
    data: { seoDescription: 'Bảng xếp hạng truyện nổi bật theo lượt đọc, đánh giá và xu hướng trên TruyenHub.' },
    providers: provideStoryRanking(),
    loadComponent: () =>
      import('../features/public/story-ranking/pages/story-ranking-page/story-ranking-page.component').then(
        (module) => module.StoryRankingPageComponent,
      ),
  },
  {
    path: 'cap-nhat',
    title: 'Cập nhật truyện mới - TruyenHub',
    data: { seoDescription: 'Theo dõi các truyện và chương mới được cập nhật gần đây trên TruyenHub.' },
    providers: provideStoryUpdates(),
    loadComponent: () =>
      import('../features/public/story-updates/pages/story-updates-page/story-updates-page.component').then(
        (module) => module.StoryUpdatesPageComponent,
      ),
  },
  {
    path: 'gioi-thieu',
    title: 'Giới thiệu - TruyenHub',
    data: { seoDescription: 'Tìm hiểu về TruyenHub và trải nghiệm đọc, quản lý truyện trên nền tảng.' },
    loadComponent: () =>
      import('../features/public/static/pages/about-page/about-page.component').then(
        (module) => module.AboutPageComponent,
      ),
  },
  {
    path: 'dieu-khoan',
    title: 'Điều khoản sử dụng - TruyenHub',
    data: { seoDescription: 'Điều khoản sử dụng dịch vụ và các nguyên tắc áp dụng khi sử dụng TruyenHub.' },
    loadComponent: () =>
      import('../features/public/static/pages/terms-page/terms-page.component').then(
        (module) => module.TermsPageComponent,
      ),
  },
  {
    path: 'quyen-rieng-tu',
    title: 'Chính sách quyền riêng tư - TruyenHub',
    data: { seoDescription: 'Chính sách quyền riêng tư và cách TruyenHub xử lý dữ liệu người dùng.' },
    loadComponent: () =>
      import('../features/public/static/pages/privacy-page/privacy-page.component').then(
        (module) => module.PrivacyPageComponent,
      ),
  },
  {
    path: 'cong-dong',
    title: 'Liên hệ hỗ trợ - TruyenHub',
    data: { seoDescription: 'Thông tin hỗ trợ và các kênh liên hệ dành cho người dùng TruyenHub.' },
    loadComponent: () =>
      import('../features/public/static/pages/support-page/support-page.component').then(
        (module) => module.SupportPageComponent,
      ),
  },
  {
    path: 'tac-gia',
    title: 'Tác giả nổi bật - TruyenHub',
    data: { seoDescription: 'Khám phá tác giả và các tác phẩm nổi bật đang được xuất bản trên TruyenHub.' },
    loadComponent: () =>
      import('../features/public/author-directory/pages/author-directory-page/author-directory-page.component').then(
        (module) => module.AuthorDirectoryPageComponent,
      ),
  },
  {
    path: 'tac-gia/:authorSlug',
    title: 'Chi tiết tác giả - TruyenHub',
    data: { seoDescription: 'Thông tin tác giả, tiểu sử và danh sách tác phẩm được xuất bản trên TruyenHub.' },
    loadComponent: () =>
      import('../features/public/author-detail/pages/author-detail-page/author-detail-page.component').then(
        (module) => module.AuthorDetailPageComponent,
      ),
  },
];
