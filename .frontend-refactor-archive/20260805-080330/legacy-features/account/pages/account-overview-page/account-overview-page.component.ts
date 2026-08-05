import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import {
  ReaderAccountIconComponent,
  ReaderAccountIconName,
} from '../../../../shared/ui/reader-account-icon/reader-account-icon.component';

interface AccountNavigationItem {
  readonly label: string;
  readonly icon: ReaderAccountIconName;
  readonly active?: boolean;
  readonly badge?: string;
  readonly danger?: boolean;
}

interface ReadingHistoryItem {
  readonly title: string;
  readonly chapter: string;
  readonly progress: number;
  readonly image: string;
  readonly accent: string;
}

interface FollowedStory {
  readonly title: string;
  readonly chapter: string;
  readonly updated: string;
  readonly image: string;
}

interface AccountActivity {
  readonly label: string;
  readonly time: string;
  readonly icon: ReaderAccountIconName;
  readonly tone: string;
}

@Component({
  selector: 'app-account-overview-page',
  standalone: true,
  imports: [ReaderAccountIconComponent],
  templateUrl: './account-overview-page.component.html',
  styleUrls: ['./account-overview-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountOverviewPageComponent {
  readonly sidebarOpen = signal(false);

  readonly primaryNavigation: readonly AccountNavigationItem[] = [
    { label: 'Tổng quan', icon: 'dashboard', active: true },
    { label: 'Thư viện của tôi', icon: 'library' },
    { label: 'Lịch sử đọc', icon: 'history' },
    { label: 'Truyện theo dõi', icon: 'heart' },
    { label: 'Đánh giá của tôi', icon: 'star' },
    { label: 'Bình luận của tôi', icon: 'comment' },
  ];

  readonly accountNavigation: readonly AccountNavigationItem[] = [
    { label: 'Thông tin tài khoản', icon: 'user' },
    { label: 'Đổi mật khẩu', icon: 'lock' },
    { label: 'Gói thành viên', icon: 'star' },
    { label: 'Lịch sử giao dịch', icon: 'calendar' },
    { label: 'Thông báo', icon: 'bell' },
  ];

  readonly settingNavigation: readonly AccountNavigationItem[] = [
    { label: 'Tùy chỉnh giao diện', icon: 'palette' },
    { label: 'Ngôn ngữ', icon: 'globe', badge: 'VI' },
    { label: 'Đăng xuất', icon: 'logout', danger: true },
  ];

  readonly history: readonly ReadingHistoryItem[] = [
    {
      title: 'Đại Đạo Chí Tôn',
      chapter: 'Chương 1278',
      progress: 85,
      image: '/assets/account/history-1.svg',
      accent: '#f3b934',
    },
    {
      title: 'Thiên Ma Chi Vương',
      chapter: 'Chương 456',
      progress: 60,
      image: '/assets/account/history-2.svg',
      accent: '#f1b632',
    },
    {
      title: 'Võ Đạo Đỉnh Phong',
      chapter: 'Chương 892',
      progress: 35,
      image: '/assets/account/history-3.svg',
      accent: '#79c968',
    },
    {
      title: 'Thần Ấn Vương Tọa',
      chapter: 'Chương 234',
      progress: 30,
      image: '/assets/account/history-4.svg',
      accent: '#78a6e9',
    },
    {
      title: 'Tiên Nghịch',
      chapter: 'Chương 236',
      progress: 20,
      image: '/assets/account/history-5.svg',
      accent: '#9b70ec',
    },
    {
      title: 'Vạn Cổ Thần Đế',
      chapter: 'Chương 112',
      progress: 15,
      image: '/assets/account/history-6.svg',
      accent: '#8e66e8',
    },
  ];

  readonly followedStories: readonly FollowedStory[] = [
    {
      title: 'Đại Đạo Chí Tôn',
      chapter: 'Chương 1278: Đột phá đại thừa',
      updated: '2 giờ trước',
      image: '/assets/account/thumb-1.svg',
    },
    {
      title: 'Thiên Ma Chi Vương',
      chapter: 'Chương 457: Ma khí bộc phát',
      updated: '3 giờ trước',
      image: '/assets/account/thumb-2.svg',
    },
    {
      title: 'Võ Đạo Đỉnh Phong',
      chapter: 'Chương 893: Võ địch thiên hạ',
      updated: '5 giờ trước',
      image: '/assets/account/thumb-3.svg',
    },
    {
      title: 'Tiên Nghịch',
      chapter: 'Chương 157: Nghịch thiên cải mệnh',
      updated: '8 giờ trước',
      image: '/assets/account/thumb-4.svg',
    },
    {
      title: 'Thần Ấn Vương Tọa',
      chapter: 'Chương 235: Thần ấn thức tỉnh',
      updated: '1 ngày trước',
      image: '/assets/account/thumb-5.svg',
    },
    {
      title: 'Vạn Cổ Thần Đế',
      chapter: 'Chương 113: Thần đế tái sinh',
      updated: '1 ngày trước',
      image: '/assets/account/thumb-6.svg',
    },
  ];

  readonly activities: readonly AccountActivity[] = [
    {
      label: 'Đánh giá truyện Đại Đạo Chí Tôn',
      time: '2 giờ trước',
      icon: 'star',
      tone: 'orange',
    },
    {
      label: 'Bình luận chương 1276',
      time: '3 giờ trước',
      icon: 'comment',
      tone: 'blue',
    },
    {
      label: 'Theo dõi truyện Thiên Ma Chi Vương',
      time: '5 giờ trước',
      icon: 'book',
      tone: 'violet',
    },
    {
      label: 'Đánh giá truyện Võ Đạo Đỉnh Phong',
      time: '1 ngày trước',
      icon: 'star',
      tone: 'orange',
    },
    {
      label: 'Bình luận chương 890',
      time: '1 ngày trước',
      icon: 'comment',
      tone: 'blue',
    },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
