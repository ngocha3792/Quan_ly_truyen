import { HeroSlide, HomePageData, QuickAction } from '../../../../shared/models/story.model';

import { STORIES } from '../../../../shared/testing/story.fixtures';

export { STORIES };

const asset = (file: string): string => `/assets/images/${file}`;

const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'hero-1',
    eyebrow: 'TRUYỆN NỔI BẬT',
    title: 'Tôi Độc Nhất\nGiữa Vạn Người',
    description:
      'Bị coi là kẻ vô dụng, không có năng lực. Sau khi thức tỉnh, tôi trở thành người mạnh nhất!',
    imageUrl: asset('hero-shadow.webp'),
    storySlug: 'toi-doc-nhat-giua-van-nguoi',
    latestChapter: 318,
    accent: 'violet',
  },
  {
    id: 'hero-2',
    eyebrow: 'ĐỀ CỬ HÔM NAY',
    title: 'Hồi Sinh Thành\nCông Tước',
    description: 'Trở lại quá khứ với toàn bộ ký ức, anh quyết định viết lại vận mệnh của gia tộc.',
    imageUrl: asset('hero-azure.webp'),
    storySlug: 'hoi-sinh-thanh-cong-tuoc',
    latestChapter: 41,
    accent: 'blue',
  },
  {
    id: 'hero-3',
    eyebrow: 'ĐANG THỊNH HÀNH',
    title: 'Ta Có 999\nLoại Dị Năng',
    description: 'Một hệ thống kỳ lạ cho phép sao chép mọi năng lực và mở ra con đường vô địch.',
    imageUrl: asset('hero-ember.webp'),
    storySlug: 'ta-co-999-loai-di-nang',
    latestChapter: 55,
    accent: 'orange',
  },
] as const;

const QUICK_ACTIONS: readonly QuickAction[] = [
  { id: 'hot', label: 'Truyện hot', description: 'Nổi bật tuần', icon: 'fire', route: '/xep-hang' },
  {
    id: 'new',
    label: 'Truyện mới',
    description: 'Cập nhật mỗi ngày',
    icon: 'sparkles',
    route: '/cap-nhat',
  },
  {
    id: 'rank',
    label: 'Xếp hạng',
    description: 'Top truyện hay',
    icon: 'trophy',
    route: '/xep-hang',
  },
  {
    id: 'categories',
    label: 'Thể loại',
    description: 'Đa dạng thể loại',
    icon: 'grid',
    route: '/the-loai',
  },
  {
    id: 'history',
    label: 'Lịch sử',
    description: 'Truyện đã đọc',
    icon: 'clock',
    route: '/lich-su',
  },
  {
    id: 'library',
    label: 'Thư viện',
    description: 'Truyện của bạn',
    icon: 'bookmark',
    route: '/thu-vien',
  },
] as const;

export const HOME_DATA: HomePageData = {
  heroSlides: HERO_SLIDES,
  quickActions: QUICK_ACTIONS,
  latestStories: STORIES.slice(0, 6),
  recommendedStories: [STORIES[6], STORIES[8], STORIES[10], STORIES[11]],
  topStories: [STORIES[6], STORIES[7], STORIES[8], STORIES[9], STORIES[10]],
  recentUpdates: [STORIES[2], STORIES[1], STORIES[0], STORIES[3]],
};
