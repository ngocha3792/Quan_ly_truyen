import { HeroSlide, HomePageData, QuickAction, Story } from '../../../shared/models/story.model';

const asset = (file: string): string => `/assets/images/${file}`;

export const STORIES: readonly Story[] = [
  {
    id: 'story-001', slug: 'dai-quan-gia-la-ma-hoang', title: 'Đại Quản Gia Là Ma Hoàng', author: 'Dạ Kiêu',
    description: 'Ma Hoàng Trác Nhất Phàm tái sinh trong thân phận quản gia và bắt đầu hành trình nghịch thiên đầy mưu lược.',
    coverUrl: asset('cover-01.webp'), categories: ['Hành động', 'Huyền huyễn'],
    latestChapter: { number: 125, slug: 'chuong-125', updatedAt: '2026-08-05T06:53:00+07:00' },
    views: 15_200_000, rating: 4.9, status: 'ONGOING', badge: 'NEW',
  },
  {
    id: 'story-002', slug: 'so-huu-nguyen-thuy-chi-luc', title: 'Sở Hữu Nguyên Thủy Chi Lực', author: 'Thiên Tằm',
    description: 'Một thiếu niên thức tỉnh nguyên lực cổ xưa, từng bước phá bỏ giới hạn của đại lục.',
    coverUrl: asset('cover-02.webp'), categories: ['Tiên hiệp', 'Phiêu lưu'],
    latestChapter: { number: 89, slug: 'chuong-89', updatedAt: '2026-08-05T06:43:00+07:00' },
    views: 9_800_000, rating: 4.8, status: 'ONGOING', badge: 'NEW',
  },
  {
    id: 'story-003', slug: 'van-co-than-de', title: 'Vạn Cổ Thần Đế', author: 'Phi Thiên Ngư',
    description: 'Một đời thần đế thức tỉnh giữa thời đại hỗn loạn và tranh đoạt lại đỉnh cao võ đạo.',
    coverUrl: asset('cover-03.webp'), categories: ['Huyền huyễn', 'Tu tiên'],
    latestChapter: { number: 233, slug: 'chuong-233', updatedAt: '2026-08-05T06:28:00+07:00' },
    views: 8_700_000, rating: 4.7, status: 'ONGOING', badge: 'HOT',
  },
  {
    id: 'story-004', slug: 'tu-phe-vat-thanh-dinh-cao', title: 'Từ Phế Vật Thành Đỉnh Cao', author: 'Mặc Vũ',
    description: 'Bị xem là phế vật, Lâm Phong sở hữu bí mật đủ để khiến chư thiên rung chuyển.',
    coverUrl: asset('cover-04.webp'), categories: ['Đô thị', 'Hệ thống'],
    latestChapter: { number: 76, slug: 'chuong-76', updatedAt: '2026-08-05T05:58:00+07:00' },
    views: 6_300_000, rating: 4.6, status: 'ONGOING', badge: 'NEW',
  },
  {
    id: 'story-005', slug: 'hoi-sinh-thanh-cong-tuoc', title: 'Hồi Sinh Thành Công Tước', author: 'Blue Moon',
    description: 'Sau cái chết oan khuất, chàng trở lại thời niên thiếu với ký ức của một đại công tước.',
    coverUrl: asset('cover-05.webp'), categories: ['Xuyên không', 'Quý tộc'],
    latestChapter: { number: 41, slug: 'chuong-41', updatedAt: '2026-08-05T04:58:00+07:00' },
    views: 5_100_000, rating: 4.7, status: 'ONGOING', badge: 'NEW',
  },
  {
    id: 'story-006', slug: 'ta-co-999-loai-di-nang', title: 'Ta Có 999 Loại Dị Năng', author: 'Hỏa Thần',
    description: 'Trong thế giới dị năng thức tỉnh, Dương Hi sở hữu kho năng lực không có giới hạn.',
    coverUrl: asset('cover-06.webp'), categories: ['Khoa huyễn', 'Dị năng'],
    latestChapter: { number: 55, slug: 'chuong-55', updatedAt: '2026-08-05T03:58:00+07:00' },
    views: 4_850_000, rating: 4.5, status: 'ONGOING', badge: 'HOT',
  },
  {
    id: 'story-007', slug: 'solo-leveling', title: 'Solo Leveling', author: 'Chugong',
    description: 'Thợ săn yếu nhất Sung Jin-Woo nhận được hệ thống bí ẩn và bắt đầu thăng cấp không giới hạn.',
    coverUrl: asset('cover-07.webp'), categories: ['Hành động', 'Huyền huyễn'],
    latestChapter: { number: 202, slug: 'chuong-202', updatedAt: '2026-08-04T23:10:00+07:00' },
    views: 18_500_000, rating: 4.9, status: 'COMPLETED', badge: 'FULL',
  },
  {
    id: 'story-008', slug: 'toi-doc-nhat-giua-van-nguoi', title: 'Tôi Độc Nhất Giữa Vạn Người', author: 'Vô Danh',
    description: 'Bị coi là kẻ vô dụng, không có năng lực. Sau khi thức tỉnh, tôi trở thành người mạnh nhất.',
    coverUrl: asset('cover-08.webp'), categories: ['Hành động', 'Hệ thống'],
    latestChapter: { number: 318, slug: 'chuong-318', updatedAt: '2026-08-04T22:30:00+07:00' },
    views: 12_800_000, rating: 4.8, status: 'ONGOING', badge: 'HOT',
  },
  {
    id: 'story-009', slug: 'than-dao-dan-ton', title: 'Thần Đạo Đan Tôn', author: 'Cô Đơn Địa Phi',
    description: 'Đan đế một thời tái sinh, mang theo tuyệt học luyện đan để bước lên thần đạo tối cao.',
    coverUrl: asset('cover-09.webp'), categories: ['Tiên hiệp', 'Huyền huyễn'],
    latestChapter: { number: 456, slug: 'chuong-456', updatedAt: '2026-08-04T20:15:00+07:00' },
    views: 8_700_000, rating: 4.7, status: 'ONGOING', badge: 'HOT',
  },
  {
    id: 'story-010', slug: 'dau-pha-thuong-khung', title: 'Đấu Phá Thương Khung', author: 'Thiên Tằm Thổ Đậu',
    description: 'Thiên tài Tiêu Viêm mất hết đấu khí và bước vào cuộc hành trình lấy lại vinh quang.',
    coverUrl: asset('cover-10.webp'), categories: ['Tiên hiệp', 'Đấu khí'],
    latestChapter: { number: 1640, slug: 'chuong-1640', updatedAt: '2026-08-04T18:00:00+07:00' },
    views: 7_600_000, rating: 4.8, status: 'COMPLETED', badge: 'FULL',
  },
  {
    id: 'story-011', slug: 'mot-minh-toi-du-suc', title: 'Một Mình Tôi Đủ Sức', author: 'Black Studio',
    description: 'Giữa tận thế đầy quái vật, một mình anh ta sở hữu sức mạnh cân cả chiến trường.',
    coverUrl: asset('cover-11.webp'), categories: ['Hành động', 'Kịch tính'],
    latestChapter: { number: 142, slug: 'chuong-142', updatedAt: '2026-08-04T16:20:00+07:00' },
    views: 5_100_000, rating: 4.5, status: 'ONGOING',
  },
  {
    id: 'story-012', slug: 'kiem-de-bat-diet', title: 'Kiếm Đế Bất Diệt', author: 'Phong Thanh Dương',
    description: 'Một kiếm trấn vạn cổ, thiếu niên mang kiếm cốt bất diệt chém xuyên chư thiên.',
    coverUrl: asset('cover-12.webp'), categories: ['Kiếm hiệp', 'Tu tiên'],
    latestChapter: { number: 97, slug: 'chuong-97', updatedAt: '2026-08-04T14:00:00+07:00' },
    views: 4_300_000, rating: 4.6, status: 'ONGOING',
  },
] as const;

const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'hero-1', eyebrow: 'TRUYỆN NỔI BẬT', title: 'Tôi Độc Nhất\nGiữa Vạn Người',
    description: 'Bị coi là kẻ vô dụng, không có năng lực. Sau khi thức tỉnh, tôi trở thành người mạnh nhất!',
    imageUrl: asset('hero-shadow.webp'), storySlug: 'toi-doc-nhat-giua-van-nguoi', latestChapter: 318, accent: 'violet',
  },
  {
    id: 'hero-2', eyebrow: 'ĐỀ CỬ HÔM NAY', title: 'Hồi Sinh Thành\nCông Tước',
    description: 'Trở lại quá khứ với toàn bộ ký ức, anh quyết định viết lại vận mệnh của gia tộc.',
    imageUrl: asset('hero-azure.webp'), storySlug: 'hoi-sinh-thanh-cong-tuoc', latestChapter: 41, accent: 'blue',
  },
  {
    id: 'hero-3', eyebrow: 'ĐANG THỊNH HÀNH', title: 'Ta Có 999\nLoại Dị Năng',
    description: 'Một hệ thống kỳ lạ cho phép sao chép mọi năng lực và mở ra con đường vô địch.',
    imageUrl: asset('hero-ember.webp'), storySlug: 'ta-co-999-loai-di-nang', latestChapter: 55, accent: 'orange',
  },
] as const;

const QUICK_ACTIONS: readonly QuickAction[] = [
  { id: 'hot', label: 'Truyện hot', description: 'Nổi bật tuần', icon: 'fire', route: '/xep-hang' },
  { id: 'new', label: 'Truyện mới', description: 'Cập nhật mỗi ngày', icon: 'sparkles', route: '/cap-nhat' },
  { id: 'rank', label: 'Xếp hạng', description: 'Top truyện hay', icon: 'trophy', route: '/xep-hang' },
  { id: 'categories', label: 'Thể loại', description: 'Đa dạng thể loại', icon: 'grid', route: '/the-loai' },
  { id: 'history', label: 'Lịch sử', description: 'Truyện đã đọc', icon: 'clock', route: '/lich-su' },
  { id: 'library', label: 'Thư viện', description: 'Truyện của bạn', icon: 'bookmark', route: '/thu-vien' },
] as const;

export const HOME_DATA: HomePageData = {
  heroSlides: HERO_SLIDES,
  quickActions: QUICK_ACTIONS,
  latestStories: STORIES.slice(0, 6),
  recommendedStories: [STORIES[6], STORIES[8], STORIES[10], STORIES[11]],
  topStories: [STORIES[6], STORIES[7], STORIES[8], STORIES[9], STORIES[10]],
  recentUpdates: [STORIES[2], STORIES[1], STORIES[0], STORIES[3]],
};
