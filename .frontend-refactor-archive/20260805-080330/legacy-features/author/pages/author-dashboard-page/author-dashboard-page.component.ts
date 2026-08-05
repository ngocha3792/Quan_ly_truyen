import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  PortalIconComponent,
  PortalIconName,
} from '../../../../shared/ui/portal-icon/portal-icon.component';

interface AuthorNavigationItem {
  readonly label: string;
  readonly icon: PortalIconName;
  readonly active?: boolean;
  readonly expandable?: boolean;
}

interface AuthorMetric {
  readonly label: string;
  readonly value: string;
  readonly trend: string;
  readonly icon: PortalIconName;
  readonly tone: string;
}

interface AuthorStory {
  readonly title: string;
  readonly chapter: string;
  readonly chapterTitle: string;
  readonly genres: string;
  readonly readers: string;
  readonly followers: string;
  readonly status: string;
  readonly statusTone: string;
  readonly rating: string;
  readonly image: string;
  readonly updated: string;
}

interface AuthorActivity {
  readonly title: string;
  readonly description: string;
  readonly time: string;
  readonly icon: PortalIconName;
  readonly tone: string;
}

interface AuthorSchedule {
  readonly title: string;
  readonly chapter: string;
  readonly date: string;
  readonly time: string;
}

@Component({
  selector: 'app-author-dashboard-page',
  standalone: true,
  imports: [PortalIconComponent],
  templateUrl: './author-dashboard-page.component.html',
  styleUrls: ['./author-dashboard-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorDashboardPageComponent {
  readonly sidebarOpen = signal(false);
  readonly selectedRange = signal('30 ngày qua');

  readonly navigation: readonly AuthorNavigationItem[] = [
    { label: 'Bảng điều khiển', icon: 'dashboard', active: true },
    { label: 'Truyện của tôi', icon: 'book' },
    { label: 'Viết truyện', icon: 'write', expandable: true },
    { label: 'Chương truyện', icon: 'file' },
    { label: 'Bản nháp', icon: 'edit' },
    { label: 'Lịch đăng', icon: 'calendar', expandable: true },
    { label: 'Thống kê', icon: 'chart' },
    { label: 'Bình luận', icon: 'comment' },
    { label: 'Độc giả', icon: 'users' },
    { label: 'Doanh thu', icon: 'coin' },
    { label: 'Yêu thích', icon: 'heart' },
    { label: 'Cài đặt', icon: 'settings' },
  ];

  readonly metrics: readonly AuthorMetric[] = [
    {
      label: 'Tổng lượt đọc',
      value: '1.234.567',
      trend: '18.5%',
      icon: 'book',
      tone: 'violet',
    },
    {
      label: 'Tổng người theo dõi',
      value: '12.345',
      trend: '12.7%',
      icon: 'heart',
      tone: 'pink',
    },
    {
      label: 'Đánh giá trung bình',
      value: '4.8/5',
      trend: '0.3 điểm',
      icon: 'star',
      tone: 'blue',
    },
    {
      label: 'Doanh thu ước tính',
      value: '12.750.000 ₫',
      trend: '22.1%',
      icon: 'coin',
      tone: 'orange',
    },
  ];

  readonly stories: readonly AuthorStory[] = [
    {
      title: 'Đại Đạo Chí Tôn',
      chapter: 'Chương 1278',
      chapterTitle: 'Đột phá đại thừa',
      genres: 'Tiên hiệp, Huyền huyễn',
      readers: '532.1K',
      followers: '5.2K',
      status: 'Đang ra',
      statusTone: 'green',
      rating: '4.9',
      image: '/assets/author/story-1.svg',
      updated: '2 giờ trước',
    },
    {
      title: 'Võ Đạo Đỉnh Phong',
      chapter: 'Chương 892',
      chapterTitle: 'Võ đạo đỉnh cao',
      genres: 'Võ hiệp, Huyền huyễn',
      readers: '312.8K',
      followers: '3.1K',
      status: 'Đang ra',
      statusTone: 'green',
      rating: '4.8',
      image: '/assets/author/story-2.svg',
      updated: '1 ngày trước',
    },
    {
      title: 'Thiên Ma Chi Vương',
      chapter: 'Chương 456',
      chapterTitle: 'Ma thần thức tỉnh',
      genres: 'Huyền huyễn, Đô thị',
      readers: '156.3K',
      followers: '1.8K',
      status: 'Tạm dừng',
      statusTone: 'blue',
      rating: '4.7',
      image: '/assets/author/story-3.svg',
      updated: '1 tuần trước',
    },
    {
      title: 'Thần Cấp Hệ Thống',
      chapter: 'Chương 234',
      chapterTitle: 'Hệ thống thăng cấp',
      genres: 'Hệ thống, Xuyên không',
      readers: '98.7K',
      followers: '1.2K',
      status: 'Đang ra',
      statusTone: 'green',
      rating: '4.6',
      image: '/assets/author/story-4.svg',
      updated: '3 giờ trước',
    },
    {
      title: 'Ta Có Một Tòa Tiên Phủ',
      chapter: 'Chương 156',
      chapterTitle: 'Tiên phủ hoàn thành',
      genres: 'Tiên hiệp, Hài hước',
      readers: '78.2K',
      followers: '987',
      status: 'Đang ra',
      statusTone: 'green',
      rating: '4.5',
      image: '/assets/author/story-5.svg',
      updated: '2 ngày trước',
    },
  ];

  readonly activities: readonly AuthorActivity[] = [
    {
      title: 'Độc giả VIP',
      description: 'Hoàng Minh đã ủng hộ 500 đ',
      time: '2 phút trước',
      icon: 'ranking',
      tone: 'orange',
    },
    {
      title: 'Độc giả mới',
      description: 'Linh Nhi đã theo dõi bạn',
      time: '15 phút trước',
      icon: 'users',
      tone: 'violet',
    },
    {
      title: 'Bình luận mới',
      description: 'Nguyễn Thành bình luận về chương 1277',
      time: '1 giờ trước',
      icon: 'comment',
      tone: 'blue',
    },
    {
      title: 'Đánh giá 5 sao',
      description: 'Trần Văn đánh giá 5 sao cho truyện',
      time: '2 giờ trước',
      icon: 'star',
      tone: 'orange',
    },
    {
      title: 'Lượt đọc tăng',
      description: 'Đại Đạo Chí Tôn tăng 2.5K lượt đọc',
      time: '3 giờ trước',
      icon: 'chart',
      tone: 'green',
    },
  ];

  readonly schedules: readonly AuthorSchedule[] = [
    {
      title: 'Đại Đạo Chí Tôn',
      chapter: 'Chương 1279: Thiên kiếp giáng lâm',
      date: 'Hôm nay',
      time: '20:00',
    },
    {
      title: 'Võ Đạo Đỉnh Phong',
      chapter: 'Chương 893: Võ đạo đại thành',
      date: '05/08/2026',
      time: '20:00',
    },
    {
      title: 'Thần Cấp Hệ Thống',
      chapter: 'Chương 235: Bí mật hệ thống',
      date: '06/08/2026',
      time: '20:00',
    },
    {
      title: 'Ta Có Một Tòa Tiên Phủ',
      chapter: 'Chương 157: Khách quý đến thăm',
      date: '07/08/2026',
      time: '20:00',
    },
  ];

  private readonly lineSeries: Readonly<Record<string, readonly number[][]>> = {
    '7 ngày qua': [
      [18, 28, 42, 39, 52, 61, 70],
      [10, 14, 23, 29, 27, 35, 44],
      [4, 8, 10, 13, 12, 17, 20],
    ],
    '30 ngày qua': [
      [20, 25, 44, 42, 52, 55, 48, 59, 60, 66, 54, 51, 49, 57, 60, 70, 62, 65, 63, 68, 85, 87, 79, 76, 69, 72, 90],
      [11, 13, 21, 23, 27, 29, 26, 31, 34, 30, 27, 25, 28, 31, 33, 38, 34, 32, 35, 34, 43, 45, 41, 39, 34, 36, 45],
      [5, 6, 9, 10, 12, 13, 11, 14, 15, 16, 11, 10, 12, 14, 13, 16, 14, 13, 15, 14, 19, 20, 18, 17, 14, 16, 21],
    ],
    '90 ngày qua': [
      [14, 25, 31, 28, 43, 52, 47, 62, 58, 69, 77, 72, 88],
      [9, 14, 17, 20, 24, 29, 27, 34, 32, 38, 43, 40, 49],
      [3, 7, 8, 10, 12, 15, 14, 17, 16, 20, 22, 21, 25],
    ],
  };

  readonly chartLines = computed(() =>
    this.lineSeries[this.selectedRange()].map((values) =>
      this.createChartPoints(values),
    ),
  );

  toggleSidebar(): void {
    this.sidebarOpen.update((isOpen) => !isOpen);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  setRange(range: string): void {
    this.selectedRange.set(range);
  }

  private createChartPoints(values: readonly number[]): string {
    const width = 610;
    const height = 205;
    const max = 100;
    const step = width / Math.max(values.length - 1, 1);

    return values
      .map((value, index) => {
        const x = 10 + index * step;
        const y = 214 - (value / max) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
}
