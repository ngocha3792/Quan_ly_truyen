import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminCenterIconComponent,
  AdminCenterIconName,
} from '../../../../shared/ui/admin-center-icon/admin-center-icon.component';

type PageKey =
  | 'overview'
  | 'stories'
  | 'chapters'
  | 'users'
  | 'authors'
  | 'comments'
  | 'reports'
  | 'categories'
  | 'transactions'
  | 'ads'
  | 'settings'
  | 'activity';
interface NavItem {
  label: string;
  icon: AdminCenterIconName;
  route: string;
  key: PageKey;
}
interface Story {
  id: number;
  title: string;
  author: string;
  category: string;
  status: string;
  tone: string;
  views: string;
  date: string;
  image: string;
}
interface Chapter {
  id: number;
  title: string;
  words: string;
  views: string;
  date: string;
}
interface Person {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  tone: string;
  date: string;
  avatar: string;
  count?: string;
}
interface Moderation {
  id: number;
  content: string;
  user: string;
  object: string;
  date: string;
  status: string;
  tone: string;
}
interface Category {
  id: number;
  name: string;
  count: number;
  status: string;
  tone: string;
}
interface Transaction {
  id: string;
  user: string;
  type: string;
  amount: string;
  method: string;
  date: string;
  status: string;
  tone: string;
}
interface Ad {
  id: number;
  name: string;
  position: string;
  start: string;
  end: string;
  status: string;
  tone: string;
  image: string;
}
interface Activity {
  id: number;
  actor: string;
  action: string;
  object: string;
  time: string;
  ip: string;
}

export abstract class AdminCenterPageBase {
  private readonly route = inject(ActivatedRoute);
  readonly sidebarOpen = signal(false);
  readonly activeTab = signal('Tất cả');
  readonly settingsTab = signal('Thông tin chung');

  readonly page = computed<PageKey>(() => {
    const path = this.route.snapshot.routeConfig?.path ?? 'dashboard';
    if (path === 'dashboard' || path === 'admin') return 'overview';
    if (path.includes('chapters')) return 'chapters';
    if (path.endsWith('/stories')) return 'stories';
    if (path.endsWith('/users')) return 'users';
    if (path.endsWith('/authors')) return 'authors';
    if (path.endsWith('/comments')) return 'comments';
    if (path.endsWith('/reports')) return 'reports';
    if (path.endsWith('/categories')) return 'categories';
    if (path.endsWith('/transactions')) return 'transactions';
    if (path.endsWith('/ads')) return 'ads';
    if (path.endsWith('/settings')) return 'settings';
    if (path.endsWith('/activity-logs')) return 'activity';
    return 'overview';
  });

  readonly title = computed(
    () =>
      (
        ({
          overview: 'Tổng quan',
          stories: 'Quản lý truyện',
          chapters: 'Quản lý chương - Đại Đạo Chí Tôn',
          users: 'Quản lý người dùng',
          authors: 'Quản lý tác giả',
          comments: 'Quản lý bình luận',
          reports: 'Quản lý báo cáo',
          categories: 'Quản lý danh mục',
          transactions: 'Quản lý giao dịch',
          ads: 'Quản lý quảng cáo',
          settings: 'Cấu hình hệ thống',
          activity: 'Nhật ký hoạt động',
        }) satisfies Record<PageKey, string>
      )[this.page()],
  );

  readonly nav: readonly NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', key: 'overview' },
    { label: 'Quản lý truyện', icon: 'book', route: '/admin/stories', key: 'stories' },
    {
      label: 'Quản lý chương',
      icon: 'calendar',
      route: '/admin/stories/1/chapters',
      key: 'chapters',
    },
    { label: 'Quản lý người dùng', icon: 'users', route: '/admin/users', key: 'users' },
    { label: 'Quản lý tác giả', icon: 'user', route: '/admin/authors', key: 'authors' },
    { label: 'Quản lý bình luận', icon: 'comment', route: '/admin/comments', key: 'comments' },
    { label: 'Quản lý báo cáo', icon: 'flag', route: '/admin/reports', key: 'reports' },
    { label: 'Quản lý danh mục', icon: 'category', route: '/admin/categories', key: 'categories' },
    { label: 'Quản lý giao dịch', icon: 'coin', route: '/admin/transactions', key: 'transactions' },
    { label: 'Quản lý quảng cáo', icon: 'ads', route: '/admin/ads', key: 'ads' },
    { label: 'Cấu hình hệ thống', icon: 'settings', route: '/admin/settings', key: 'settings' },
    {
      label: 'Nhật ký hoạt động',
      icon: 'activity',
      route: '/admin/activity-logs',
      key: 'activity',
    },
  ];

  readonly stories: readonly Story[] = [
    {
      id: 1,
      title: 'Đại Đạo Chí Tôn',
      author: 'Mặc Hương Đồng Khứu',
      category: 'Tiên hiệp',
      status: 'Đang ra',
      tone: 'green',
      views: '4.2M',
      date: '15/07/2024',
      image: '/assets/admin-center/story-1.svg',
    },
    {
      id: 2,
      title: 'Võ Thần Chúa Tể',
      author: 'Ám Ma Sư',
      category: 'Huyền huyễn',
      status: 'Đang ra',
      tone: 'green',
      views: '3.8M',
      date: '10/07/2024',
      image: '/assets/admin-center/story-2.svg',
    },
    {
      id: 3,
      title: 'Thần Ma Chi Vương',
      author: 'Lâm Ung Cực Tốc',
      category: 'Huyền huyễn',
      status: 'Đang ra',
      tone: 'green',
      views: '2.9M',
      date: '05/07/2024',
      image: '/assets/admin-center/story-3.svg',
    },
    {
      id: 4,
      title: 'Thần Ấn Vương Tọa',
      author: 'Đường Gia Tam Thiếu',
      category: 'Huyền huyễn',
      status: 'Đang ra',
      tone: 'green',
      views: '2.5M',
      date: '01/07/2024',
      image: '/assets/admin-center/story-4.svg',
    },
    {
      id: 5,
      title: 'Võ Đạo Đỉnh Phong',
      author: 'Mạc Mặc',
      category: 'Võ hiệp',
      status: 'Tạm dừng',
      tone: 'blue',
      views: '2.1M',
      date: '28/06/2024',
      image: '/assets/admin-center/story-5.svg',
    },
    {
      id: 6,
      title: 'Tiên Nghịch',
      author: 'Nhĩ Căn',
      category: 'Tiên hiệp',
      status: 'Hoàn thành',
      tone: 'blue',
      views: '5.7M',
      date: '20/02/2024',
      image: '/assets/admin-center/story-6.svg',
    },
    {
      id: 7,
      title: 'Đấu Phá Thương Khung',
      author: 'Thiên Tằm Thổ Đậu',
      category: 'Huyền huyễn',
      status: 'Hoàn thành',
      tone: 'blue',
      views: '8.9M',
      date: '15/02/2024',
      image: '/assets/admin-center/story-7.svg',
    },
    {
      id: 8,
      title: 'Thần Cấp Phản Sát',
      author: 'Vạn Đại',
      category: 'Đô thị',
      status: 'Hoàn thành',
      tone: 'blue',
      views: '6.1M',
      date: '10/02/2024',
      image: '/assets/admin-center/story-8.svg',
    },
  ];

  readonly chapters: readonly Chapter[] = Array.from({ length: 10 }, (_, i) => ({
    id: 1278 - i,
    title: [
      'Đột phá đại thừa',
      'Thiên kiếp giáng lâm',
      'Hỗn độn chi lực',
      'Đạo tâm kiên nghị',
      'Thần hồn chấn động',
      'Bí cảnh tu luyện',
      'Kỳ ngộ bí cảnh',
      'Ma tộc xâm lấn',
      'Chuẩn bị chiến đấu',
      'Thăm dò',
    ][i],
    words: [
      '2,458',
      '2,312',
      '2,185',
      '2,521',
      '2,486',
      '2,112',
      '2,654',
      '2,321',
      '2,145',
      '2,012',
    ][i],
    views: [
      '15,314',
      '22,456',
      '18,765',
      '20,145',
      '17,895',
      '16,234',
      '19,876',
      '21,456',
      '15,678',
      '14,567',
    ][i],
    date: `${25 - i}/05/2024 10:30`,
  }));

  readonly users: readonly Person[] = [
    ['nguyenvana', 'nguyenvana@gmail.com', 'Người dùng', 'Hoạt động', 'green', '15/03/2024'],
    ['lehoang', 'lehoang@gmail.com', 'VIP', 'Hoạt động', 'green', '14/03/2024'],
    ['phamminh', 'phamminh@gmail.com', 'Người dùng', 'Hoạt động', 'green', '14/03/2024'],
    ['tranthanh', 'tranthanh@gmail.com', 'VIP', 'Hoạt động', 'green', '13/03/2024'],
    ['hoangnam', 'hoangnam@gmail.com', 'Người dùng', 'Bị khóa', 'red', '12/03/2024'],
    ['datuy', 'datuy@gmail.com', 'Người dùng', 'Hoạt động', 'green', '11/03/2024'],
    ['ngocthanh', 'ngocthanh@gmail.com', 'VIP', 'Hoạt động', 'green', '11/03/2024'],
    ['minhanh', 'minhanh@gmail.com', 'Người dùng', 'Hoạt động', 'green', '10/03/2024'],
  ].map((x, i) => ({
    id: i + 1,
    name: x[0],
    email: x[1],
    role: x[2],
    status: x[3],
    tone: x[4],
    date: x[5],
    avatar: `/assets/admin-center/avatar-${i + 1}.svg`,
  }));

  readonly authors: readonly Person[] = [
    ['Mặc Hương Đồng Khứu', 'mochuong@gmail.com', '5 truyện', 'Hoạt động', 'green', '12,456'],
    ['Nhĩ Căn', 'nhican@gmail.com', '3 truyện', 'Hoạt động', 'green', '8,765'],
    ['Đường Gia Tam Thiếu', 'duonggia@gmail.com', '4 truyện', 'Hoạt động', 'green', '15,678'],
    ['Thiên Tằm Thổ Đậu', 'thientam@gmail.com', '6 truyện', 'Hoạt động', 'green', '18,234'],
    ['Lão Ưng Cật Tiểu Kê', 'laoung@gmail.com', '2 truyện', 'Hoạt động', 'green', '6,789'],
    ['Mộng Nhập Thần Cơ', 'mongnhap@gmail.com', '3 truyện', 'Tạm khóa', 'blue', '7,654'],
  ].map((x, i) => ({
    id: i + 1,
    name: x[0],
    email: x[1],
    role: x[2],
    status: x[3],
    tone: x[4],
    date: '',
    count: x[5],
    avatar: `/assets/admin-center/avatar-${i + 1}.svg`,
  }));

  readonly comments: readonly Moderation[] = [
    {
      id: 1,
      content: 'Truyện hay quá, mong ra chương mới nhanh!',
      user: 'nguyenvana',
      object: 'Đại Đạo Chí Tôn',
      date: '25/05/2024 10:35',
      status: 'Đã duyệt',
      tone: 'green',
    },
    {
      id: 2,
      content: 'Main bá quá, đọc sướng thật sự!',
      user: 'lehoang',
      object: 'Võ Thần Chúa Tể',
      date: '25/05/2024 10:30',
      status: 'Chờ duyệt',
      tone: 'orange',
    },
    {
      id: 3,
      content: 'Cốt truyện hấp dẫn, không thể ngừng đọc',
      user: 'phamminh',
      object: 'Thần Ma Chi Vương',
      date: '25/05/2024 10:28',
      status: 'Đã duyệt',
      tone: 'green',
    },
    {
      id: 4,
      content: 'Ad dịch hơi chậm, mong nhanh hơn',
      user: 'tranthanh',
      object: 'Thần Ấn Vương Tọa',
      date: '25/05/2024 10:25',
      status: 'Đã ẩn',
      tone: 'red',
    },
    {
      id: 5,
      content: 'Tác giả viết quá đỉnh!',
      user: 'hoangnam',
      object: 'Võ Đạo Đỉnh Phong',
      date: '25/05/2024 10:20',
      status: 'Chờ duyệt',
      tone: 'orange',
    },
  ];

  readonly reports: readonly Moderation[] = [
    {
      id: 1,
      content: 'Truyện có nội dung lặp tục',
      user: 'nguyenvana',
      object: 'Spam/Quảng cáo',
      date: '25/05/2024',
      status: 'Đã xử lý',
      tone: 'green',
    },
    {
      id: 2,
      content: 'Bình luận spam link',
      user: 'lehoang',
      object: 'Spam/Quảng cáo',
      date: '25/05/2024',
      status: 'Đang xử lý',
      tone: 'blue',
    },
    {
      id: 3,
      content: 'Nội dung sao chép từ trang khác',
      user: 'phamminh',
      object: 'Vi phạm bản quyền',
      date: '25/05/2024',
      status: 'Chờ xử lý',
      tone: 'orange',
    },
    {
      id: 4,
      content: 'Từ ngữ tục tĩu',
      user: 'tranthanh',
      object: 'Nội dung không phù hợp',
      date: '24/05/2024',
      status: 'Đang xử lý',
      tone: 'blue',
    },
    {
      id: 5,
      content: 'Quảng cáo sản phẩm',
      user: 'hoangnam',
      object: 'Spam/Quảng cáo',
      date: '24/05/2024',
      status: 'Đã xử lý',
      tone: 'green',
    },
  ];

  readonly categories: readonly Category[] = [
    { id: 1, name: 'Tiên hiệp', count: 456, status: 'Hiển thị', tone: 'green' },
    { id: 2, name: 'Huyền huyễn', count: 789, status: 'Hiển thị', tone: 'green' },
    { id: 3, name: 'Võ hiệp', count: 234, status: 'Hiển thị', tone: 'green' },
    { id: 4, name: 'Đô thị', count: 345, status: 'Hiển thị', tone: 'green' },
    { id: 5, name: 'Khoa huyễn', count: 123, status: 'Ẩn', tone: 'red' },
    { id: 6, name: 'Lịch sử', count: 98, status: 'Ẩn', tone: 'red' },
  ];

  readonly transactions: readonly Transaction[] = [
    {
      id: 'GD202405001',
      user: 'nguyenvana',
      type: 'Nạp tiền',
      amount: '100.000đ',
      method: 'MoMo',
      date: '25/05/2024 10:30',
      status: 'Thành công',
      tone: 'green',
    },
    {
      id: 'GD202405002',
      user: 'lehoang',
      type: 'Mua VIP 1 tháng',
      amount: '79.000đ',
      method: 'ZaloPay',
      date: '25/05/2024 10:25',
      status: 'Thành công',
      tone: 'green',
    },
    {
      id: 'GD202405003',
      user: 'phamminh',
      type: 'Nạp tiền',
      amount: '200.000đ',
      method: 'Thẻ cào',
      date: '25/05/2024 10:20',
      status: 'Thành công',
      tone: 'green',
    },
    {
      id: 'GD202405004',
      user: 'tranthanh',
      type: 'Mua VIP 3 tháng',
      amount: '199.000đ',
      method: 'MoMo',
      date: '25/05/2024 10:15',
      status: 'Thành công',
      tone: 'green',
    },
    {
      id: 'GD202405005',
      user: 'hoangnam',
      type: 'Nạp tiền',
      amount: '500.000đ',
      method: 'Banking',
      date: '25/05/2024 10:10',
      status: 'Thất bại',
      tone: 'red',
    },
  ];

  readonly ads: readonly Ad[] = [
    {
      id: 1,
      name: 'Trang chủ - Top',
      position: 'Trang chủ - Top',
      start: '20/05/2024',
      end: '27/05/2024',
      status: 'Hiển thị',
      tone: 'green',
      image: '/assets/admin-center/ad-1.svg',
    },
    {
      id: 2,
      name: 'Sidebar',
      position: 'Sidebar',
      start: '18/05/2024',
      end: '26/05/2024',
      status: 'Hiển thị',
      tone: 'green',
      image: '/assets/admin-center/ad-2.svg',
    },
    {
      id: 3,
      name: 'Giữa trang',
      position: 'Giữa trang',
      start: '15/05/2024',
      end: '22/05/2024',
      status: 'Ẩn',
      tone: 'red',
      image: '/assets/admin-center/ad-3.svg',
    },
  ];

  readonly activities: readonly Activity[] = [
    {
      id: 1,
      actor: 'admin',
      action: 'Thêm truyện mới',
      object: 'Đại Đạo Chí Tôn',
      time: '25/05/2024 10:30:45',
      ip: '192.168.1.1',
    },
    {
      id: 2,
      actor: 'admin',
      action: 'Cập nhật chương',
      object: 'Chương 1278',
      time: '25/05/2024 10:28:20',
      ip: '192.168.1.1',
    },
    {
      id: 3,
      actor: 'moderator1',
      action: 'Duyệt bình luận',
      object: 'Bình luận ID: 1234',
      time: '25/05/2024 10:25:15',
      ip: '192.168.1.2',
    },
    {
      id: 4,
      actor: 'admin',
      action: 'Khóa tài khoản',
      object: 'nguyenvana',
      time: '25/05/2024 10:20:30',
      ip: '192.168.1.1',
    },
    {
      id: 5,
      actor: 'admin',
      action: 'Cập nhật cấu hình',
      object: 'Thông tin chung',
      time: '25/05/2024 10:15:10',
      ip: '192.168.1.1',
    },
  ];

  readonly chartPoints =
    '0,168 38,150 76,108 114,92 152,98 190,74 228,82 266,58 304,74 342,92 380,70 418,42 456,50 494,34 532,58 570,72 608,82';
  readonly chartArea = `0,168 ${this.chartPoints} 608,185 0,185`;

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
