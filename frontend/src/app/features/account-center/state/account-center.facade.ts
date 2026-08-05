import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AccountCenterIconComponent,
  AccountCenterIconName,
} from '../components/account-center-icon/account-center-icon.component';

type AccountPageKey =
  | 'overview'
  | 'history'
  | 'library'
  | 'following'
  | 'reviews'
  | 'comments'
  | 'profile'
  | 'security'
  | 'notifications'
  | 'transactions';

interface AccountNavItem {
  readonly label: string;
  readonly icon: AccountCenterIconName;
  readonly route: string;
  readonly key: AccountPageKey;
  readonly danger?: boolean;
}

interface StoryItem {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly chapter: string;
  readonly genre: string;
  readonly updated: string;
  readonly progress: number;
  readonly image: string;
  readonly rating: string;
  readonly status: string;
}

interface ReviewItem {
  readonly id: string;
  readonly title: string;
  readonly chapter: string;
  readonly content: string;
  readonly time: string;
  readonly image: string;
  readonly rating: number;
}

interface CommentItem {
  readonly id: string;
  readonly title: string;
  readonly chapter: string;
  readonly content: string;
  readonly time: string;
  readonly likes: string;
  readonly image: string;
}

interface TransactionItem {
  readonly id: string;
  readonly type: string;
  readonly amount: string;
  readonly status: string;
  readonly date: string;
}

@Injectable()
export class AccountCenterFacade {
  private readonly route = inject(ActivatedRoute);

  readonly sidebarOpen = signal(false);
  readonly activeLibraryTab = signal('Tất cả');
  readonly activeHistoryTab = signal('Tất cả');
  readonly notificationSettings = signal<Record<string, boolean>>({
    system: true,
    following: true,
    comments: true,
    reviews: false,
    email: true,
    mobile: true,
  });

  readonly page = computed<AccountPageKey>(() => {
    const routePath = this.route.snapshot.routeConfig?.path ?? 'account';

    if (routePath.endsWith('/history')) return 'history';
    if (routePath.endsWith('/library')) return 'library';
    if (routePath.endsWith('/following')) return 'following';
    if (routePath.endsWith('/reviews')) return 'reviews';
    if (routePath.endsWith('/comments')) return 'comments';
    if (routePath.endsWith('/profile')) return 'profile';
    if (routePath.endsWith('/security')) return 'security';
    if (routePath.endsWith('/notifications')) return 'notifications';
    if (routePath.endsWith('/transactions')) return 'transactions';

    return 'overview';
  });

  readonly title = computed(() => {
    const titles: Record<AccountPageKey, string> = {
      overview: 'Tổng quan tài khoản',
      history: 'Lịch sử đọc',
      library: 'Thư viện của tôi',
      following: 'Truyện theo dõi',
      reviews: 'Đánh giá của tôi',
      comments: 'Bình luận của tôi',
      profile: 'Thông tin tài khoản',
      security: 'Bảo mật',
      notifications: 'Thông báo',
      transactions: 'Lịch sử giao dịch',
    };

    return titles[this.page()];
  });

  readonly primaryNavigation: readonly AccountNavItem[] = [
    { label: 'Tổng quan', icon: 'dashboard', route: '/account', key: 'overview' },
    { label: 'Lịch sử đọc', icon: 'history', route: '/account/history', key: 'history' },
    { label: 'Thư viện của tôi', icon: 'library', route: '/account/library', key: 'library' },
    { label: 'Truyện theo dõi', icon: 'heart', route: '/account/following', key: 'following' },
    { label: 'Đánh giá của tôi', icon: 'star', route: '/account/reviews', key: 'reviews' },
    { label: 'Bình luận của tôi', icon: 'comment', route: '/account/comments', key: 'comments' },
  ];

  readonly accountNavigation: readonly AccountNavItem[] = [
    { label: 'Thông tin tài khoản', icon: 'user', route: '/account/profile', key: 'profile' },
    { label: 'Bảo mật', icon: 'lock', route: '/account/security', key: 'security' },
    { label: 'Thông báo', icon: 'bell', route: '/account/notifications', key: 'notifications' },
    { label: 'Giao dịch', icon: 'calendar', route: '/account/transactions', key: 'transactions' },
  ];

  readonly stories: readonly StoryItem[] = [
    {
      id: 'dao-doc-chi-ton',
      title: 'Đạo Độc Chí Tôn',
      author: 'Mặc Hương Đồng Khứu',
      chapter: 'Chương 1278: Đột phá đại thừa',
      genre: 'Tiên hiệp',
      updated: '2 giờ trước',
      progress: 85,
      image: '/assets/account-center/cover-1.svg',
      rating: '4.9',
      status: 'Đang đọc',
    },
    {
      id: 'thien-ma-chi-vuong',
      title: 'Thiên Ma Chi Vương',
      author: 'Dạ Mặc',
      chapter: 'Chương 456: Ma linh bộc phát',
      genre: 'Huyền huyễn',
      updated: '5 giờ trước',
      progress: 60,
      image: '/assets/account-center/cover-2.svg',
      rating: '4.8',
      status: 'Đang đọc',
    },
    {
      id: 'vo-dao-dinh-phong',
      title: 'Võ Đạo Đỉnh Phong',
      author: 'Mạc Mặc',
      chapter: 'Chương 892: Võ đạo thiên hạ',
      genre: 'Võ hiệp',
      updated: '1 ngày trước',
      progress: 42,
      image: '/assets/account-center/cover-3.svg',
      rating: '4.8',
      status: 'Đang đọc',
    },
    {
      id: 'than-an-vuong-toa',
      title: 'Thần Ấn Vương Tọa',
      author: 'Đường Gia Tam Thiếu',
      chapter: 'Chương 235: Thần ấn thức tỉnh',
      genre: 'Huyền huyễn',
      updated: '1 ngày trước',
      progress: 33,
      image: '/assets/account-center/cover-4.svg',
      rating: '4.7',
      status: 'Đã hoàn thành',
    },
    {
      id: 'tien-nghich',
      title: 'Tiên Nghịch',
      author: 'Nhĩ Căn',
      chapter: 'Chương 157: Nghịch thiên cải mệnh',
      genre: 'Tiên hiệp',
      updated: '2 ngày trước',
      progress: 26,
      image: '/assets/account-center/cover-5.svg',
      rating: '4.7',
      status: 'Đang đọc',
    },
    {
      id: 'van-co-than-de',
      title: 'Vạn Cổ Thần Đế',
      author: 'Phi Thiên Ngư',
      chapter: 'Chương 113: Thần đế tái sinh',
      genre: 'Huyền huyễn',
      updated: '3 ngày trước',
      progress: 18,
      image: '/assets/account-center/cover-6.svg',
      rating: '4.6',
      status: 'Tạm ngưng',
    },
    {
      id: 'than-an-vuong-toa-2',
      title: 'Thần Ấn Vương Tọa',
      author: 'Đường Gia Tam Thiếu',
      chapter: 'Chương 25',
      genre: 'Huyền huyễn',
      updated: '4 ngày trước',
      progress: 11,
      image: '/assets/account-center/cover-7.svg',
      rating: '4.6',
      status: 'Đang đọc',
    },
    {
      id: 'than-cap-he-thong',
      title: 'Thần Cấp Hệ Thống',
      author: 'Vạn Cổ Thanh',
      chapter: 'Chương 234',
      genre: 'Hệ thống',
      updated: '5 ngày trước',
      progress: 72,
      image: '/assets/account-center/cover-8.svg',
      rating: '4.5',
      status: 'Đã hoàn thành',
    },
  ];

  readonly reviews: readonly ReviewItem[] = [
    {
      id: 'r1',
      title: 'Đạo Độc Chí Tôn',
      chapter: 'Chương 1278',
      content: 'Truyện hay, tình tiết hấp dẫn, nhân vật được xây dựng tốt!',
      time: '2 giờ trước',
      image: '/assets/account-center/thumb-1.svg',
      rating: 5,
    },
    {
      id: 'r2',
      title: 'Thiên Ma Chi Vương',
      chapter: 'Chương 456',
      content: 'Cốt truyện ổn, main bá đạo, nhưng một số đoạn hơi dài dòng.',
      time: '1 ngày trước',
      image: '/assets/account-center/thumb-2.svg',
      rating: 4,
    },
    {
      id: 'r3',
      title: 'Võ Đạo Đỉnh Phong',
      chapter: 'Chương 893',
      content: 'Truyện rất cuốn, đọc chương thế đứng lại!',
      time: '3 ngày trước',
      image: '/assets/account-center/thumb-3.svg',
      rating: 5,
    },
    {
      id: 'r4',
      title: 'Tiên Nghịch',
      chapter: 'Chương 157',
      content: 'Ý tưởng hay, thế giới quan rộng lớn.',
      time: '5 ngày trước',
      image: '/assets/account-center/thumb-4.svg',
      rating: 4,
    },
    {
      id: 'r5',
      title: 'Thần Nghịch',
      chapter: 'Chương 157',
      content: 'Cảnh cao trào chưa thật sự bùng nổ nhưng vẫn đáng đọc.',
      time: '1 tuần trước',
      image: '/assets/account-center/thumb-5.svg',
      rating: 3,
    },
  ];

  readonly comments: readonly CommentItem[] = [
    {
      id: 'c1',
      title: 'Đạo Độc Chí Tôn',
      chapter: 'Chương 1278',
      content: 'Đoạn này quá hay! Main chính thức đột phá!',
      time: '2 giờ trước',
      likes: '12',
      image: '/assets/account-center/thumb-1.svg',
    },
    {
      id: 'c2',
      title: 'Thiên Ma Chi Vương',
      chapter: 'Chương 456',
      content: 'Ma khí bộc phát quả đúng là bước ngoặt lớn.',
      time: '5 giờ trước',
      likes: '8',
      image: '/assets/account-center/thumb-2.svg',
    },
    {
      id: 'c3',
      title: 'Võ Đạo Đỉnh Phong',
      chapter: 'Chương 893',
      content: 'Pha chiến đấu mượt và rất đã mắt!',
      time: '1 ngày trước',
      likes: '15',
      image: '/assets/account-center/thumb-3.svg',
    },
    {
      id: 'c4',
      title: 'Tiên Nghịch',
      chapter: 'Chương 157',
      content: 'Nghịch thiên cải mệnh, quá đỉnh!',
      time: '2 ngày trước',
      likes: '9',
      image: '/assets/account-center/thumb-4.svg',
    },
  ];

  readonly transactions: readonly TransactionItem[] = [
    {
      id: 'GD20240815001',
      type: 'Nạp 500 xu',
      amount: '50.000 ₫',
      status: 'Thành công',
      date: '15/08/2024 10:30',
    },
    {
      id: 'GD20240815002',
      type: 'Mua VIP 1 tháng',
      amount: '79.000 ₫',
      status: 'Thành công',
      date: '01/08/2024 09:15',
    },
    {
      id: 'GD20240715003',
      type: 'Nạp 1000 xu',
      amount: '100.000 ₫',
      status: 'Thành công',
      date: '15/07/2024 14:20',
    },
    {
      id: 'GD20240615004',
      type: 'Mua VIP 3 tháng',
      amount: '199.000 ₫',
      status: 'Thành công',
      date: '01/06/2024 08:45',
    },
    {
      id: 'GD20240315005',
      type: 'Nạp 2000 xu',
      amount: '200.000 ₫',
      status: 'Thành công',
      date: '15/03/2024 16:10',
    },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleNotification(key: string): void {
    this.notificationSettings.update((settings) => ({
      ...settings,
      [key]: !settings[key],
    }));
  }

  notificationEnabled(key: string): boolean {
    return this.notificationSettings()[key];
  }
}
