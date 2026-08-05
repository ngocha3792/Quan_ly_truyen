import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type PageKey =
  | 'overview' | 'stories' | 'chapters' | 'editor' | 'analytics' | 'revenue'
  | 'messages' | 'notifications' | 'profile' | 'settings' | 'support' | 'community';

interface NavItem {
  readonly key: PageKey;
  readonly label: string;
  readonly route: string;
  readonly icon: string;
}

interface Story {
  readonly id: number;
  readonly title: string;
  readonly genre: string;
  readonly chapters: number;
  readonly reads: string;
  readonly followers: string;
  readonly rating: string;
  readonly status: string;
  readonly tone: string;
  readonly image: string;
}

@Component({
  selector: 'app-author-suite-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './author-suite-page.component.html',
  styleUrls: ['./author-suite-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuitePageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly sidebarOpen = signal(false);
  readonly activeTab = signal('Tất cả');
  readonly settingsTab = signal('Tài khoản');

  readonly page = computed<PageKey>(() => {
    const path = this.route.snapshot.routeConfig?.path ?? 'author';
    if (path === 'author') return 'overview';
    if (path.endsWith('/stories/new') || path.endsWith('/stories/:id/edit')) return 'editor';
    if (path.endsWith('/stories/:id/chapters')) return 'chapters';
    if (path.endsWith('/stories')) return 'stories';
    if (path.endsWith('/analytics')) return 'analytics';
    if (path.endsWith('/revenue')) return 'revenue';
    if (path.endsWith('/messages')) return 'messages';
    if (path.endsWith('/notifications')) return 'notifications';
    if (path.endsWith('/profile')) return 'profile';
    if (path.endsWith('/settings')) return 'settings';
    if (path.endsWith('/support')) return 'support';
    return 'community';
  });

  readonly title = computed(() => ({
    overview: 'Tổng quan tác giả',
    stories: 'Truyện của tôi',
    chapters: 'Quản lý chương',
    editor: 'Tạo / Chỉnh sửa truyện',
    analytics: 'Thống kê chi tiết',
    revenue: 'Doanh thu',
    messages: 'Tin nhắn độc giả',
    notifications: 'Thông báo',
    profile: 'Hồ sơ tác giả',
    settings: 'Cài đặt',
    support: 'Trung tâm hỗ trợ',
    community: 'Cộng đồng tác giả',
  })[this.page()]);

  readonly nav: readonly NavItem[] = [
    { key: 'overview', label: 'Tổng quan', route: '/author', icon: '▦' },
    { key: 'stories', label: 'Truyện của tôi', route: '/author/stories', icon: '▤' },
    { key: 'chapters', label: 'Quản lý chương', route: '/author/stories/1/chapters', icon: '☷' },
    { key: 'editor', label: 'Tạo truyện', route: '/author/stories/new', icon: '✎' },
    { key: 'analytics', label: 'Thống kê', route: '/author/analytics', icon: '⌁' },
    { key: 'revenue', label: 'Doanh thu', route: '/author/revenue', icon: '₫' },
    { key: 'messages', label: 'Tin nhắn', route: '/author/messages', icon: '✉' },
    { key: 'notifications', label: 'Thông báo', route: '/author/notifications', icon: '♢' },
    { key: 'profile', label: 'Hồ sơ tác giả', route: '/author/profile', icon: '◉' },
    { key: 'settings', label: 'Cài đặt', route: '/author/settings', icon: '⚙' },
    { key: 'support', label: 'Trung tâm hỗ trợ', route: '/author/support', icon: '?' },
    { key: 'community', label: 'Cộng đồng tác giả', route: '/author/community', icon: '♧' },
  ];

  readonly stories: readonly Story[] = [
    { id: 1, title: 'Ma Đạo Chí Tôn', genre: 'Tiên hiệp', chapters: 456, reads: '2.4M', followers: '48.6K', rating: '4.9', status: 'Đang ra', tone: 'green', image: '/assets/author-suite/story-1.svg' },
    { id: 2, title: 'Thiên Vực Quỷ Thần', genre: 'Huyền huyễn', chapters: 321, reads: '1.6M', followers: '26.2K', rating: '4.8', status: 'Đang ra', tone: 'green', image: '/assets/author-suite/story-2.svg' },
    { id: 3, title: 'Vạn Cổ Đế Tôn', genre: 'Huyền huyễn', chapters: 218, reads: '1.2M', followers: '18.4K', rating: '4.8', status: 'Đang ra', tone: 'green', image: '/assets/author-suite/story-3.svg' },
    { id: 4, title: 'Đoạt Thiên Chi Lộ', genre: 'Kiếm hiệp', chapters: 128, reads: '890K', followers: '12.6K', rating: '4.7', status: 'Hoàn thành', tone: 'blue', image: '/assets/author-suite/story-4.svg' },
    { id: 5, title: 'Huyền Thiên Liên', genre: 'Tiên hiệp', chapters: 125, reads: '680K', followers: '8.2K', rating: '4.7', status: 'Tạm ngưng', tone: 'orange', image: '/assets/author-suite/story-5.svg' },
  ];

  readonly chapters = [
    ['1279', 'Thần Ma đại chiến', '5.2K', '26/05/2024 10:30', 'Đã đăng', 'green'],
    ['1278', 'Đột phá đại thừa', '8.4K', '25/05/2024 20:00', 'Đã đăng', 'green'],
    ['1277', 'Thần thế giáng kiếm', '7.9K', '25/05/2024 10:30', 'Đã đăng', 'green'],
    ['1276', 'Hỗn chiến đế lực', '6.8K', '24/05/2024 20:05', 'Đã đăng', 'green'],
    ['1275', 'Đạo tâm cẩm môn', '6.2K', '23/05/2024 10:30', 'Đã đăng', 'green'],
    ['1274', 'Cấm địa bí mật', '-', '22/05/2024 08:00', 'Bản nháp', 'orange'],
  ] as const;

  readonly messages = [
    ['Bình Minh', 'Rất thích truyện của tác giả!', '10:30', '/assets/author-suite/avatar-1.svg'],
    ['Huyền Nhi', 'Khi nào có chương mới vậy ạ?', '09:15', '/assets/author-suite/avatar-2.svg'],
    ['Đệ Quân', 'Tác giả viết truyện quá hay!', 'Hôm qua', '/assets/author-suite/avatar-3.svg'],
    ['Thiên Long', 'Có dự định viết phần 2 không ạ?', '24/05', '/assets/author-suite/avatar-4.svg'],
    ['Vân Mộng', 'Cảm ơn tác giả!', '23/05', '/assets/author-suite/avatar-5.svg'],
  ] as const;

  readonly notices = [
    ['Chương 1279 đã được duyệt', 'Ma Đạo Chí Tôn', '5 phút trước', 'violet'],
    ['Bạn nhận được quà tặng 500 xu', 'Từ độc giả Nam Vương', '2 giờ trước', 'orange'],
    ['Truyện lọt top trending tuần này', 'Ma Đạo Chí Tôn', '1 ngày trước', 'blue'],
    ['Doanh thu tháng 5 đã cập nhật', '12.450.000 ₫', '2 ngày trước', 'green'],
    ['Có 10.000 lượt đọc mới', 'Chương 1278', '2 ngày trước', 'violet'],
  ] as const;

  readonly transactions = [
    ['DT20240501', 'Doanh thu chương 1278', '+1.250.000 ₫', 'Hệ thống', '24/05/2024 10:30'],
    ['DT20240502', 'Doanh thu chương 1277', '+980.000 ₫', 'Hệ thống', '24/05/2024 11:15'],
    ['DT20240503', 'Rút tiền', '-5.000.000 ₫', 'Ngân hàng', '24/05/2024 15:30'],
    ['DT20240504', 'Doanh thu chương 1276', '+900.000 ₫', 'Hệ thống', '24/05/2024 20:00'],
    ['DT20240505', 'Quà tặng độc giả', '+210.000 ₫', 'Hệ thống', '23/05/2024 09:40'],
  ] as const;

  readonly chartPoints = '0,160 40,132 80,85 120,98 160,72 200,55 240,68 280,45 320,42 360,60 400,30 440,38 480,21 520,48 560,42 600,27';

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
