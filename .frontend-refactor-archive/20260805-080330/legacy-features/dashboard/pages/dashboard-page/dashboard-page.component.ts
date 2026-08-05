import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  AppIconComponent,
  AppIconName,
} from '../../../../shared/ui/app-icon/app-icon.component';

interface NavigationItem {
  readonly label: string;
  readonly icon: AppIconName;
  readonly badge?: string;
  readonly active?: boolean;
}

interface StatisticCard {
  readonly label: string;
  readonly value: string;
  readonly comparison: string;
  readonly icon: AppIconName;
  readonly tone: 'violet' | 'blue' | 'green' | 'orange';
}

interface SystemStatus {
  readonly label: string;
  readonly icon: AppIconName;
}

interface ActivityItem {
  readonly actor: string;
  readonly action: string;
  readonly detail: string;
  readonly time: string;
  readonly avatar: string;
  readonly tone: 'violet' | 'blue' | 'green' | 'orange';
}

interface StoryRow {
  readonly title: string;
  readonly chapter: string;
  readonly author: string;
  readonly genre: string;
  readonly genreTone: 'violet' | 'blue' | 'orange';
  readonly status: string;
  readonly statusTone: 'green' | 'blue' | 'gray';
  readonly views: string;
  readonly updatedAt: string;
  readonly coverClass: string;
  readonly coverText: string;
}

interface ChartBar {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [AppIconComponent],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  readonly sidebarOpen = signal(false);
  readonly selectedRange = signal('30 ngày');

  readonly ranges = ['7 ngày', '30 ngày', '90 ngày', '1 năm'] as const;

  readonly navigation: readonly NavigationItem[] = [
    { label: 'Tổng quan', icon: 'grid', active: true },
    { label: 'Truyện', icon: 'book-open' },
    { label: 'Chương', icon: 'file-text' },
    { label: 'Tác giả', icon: 'user' },
    { label: 'Thể loại', icon: 'tag' },
    { label: 'Người dùng', icon: 'users' },
    { label: 'Bình luận', icon: 'message' },
    { label: 'Báo cáo', icon: 'activity' },
    { label: 'Thông báo', icon: 'bell', badge: '5' },
    { label: 'Cài đặt', icon: 'settings' },
  ];

  readonly statistics: readonly StatisticCard[] = [
    {
      label: 'Tổng số truyện',
      value: '1,248',
      comparison: '12.5%',
      icon: 'book-open',
      tone: 'violet',
    },
    {
      label: 'Chương mới',
      value: '342',
      comparison: '18.7%',
      icon: 'file-text',
      tone: 'blue',
    },
    {
      label: 'Người dùng hoạt động',
      value: '15,892',
      comparison: '8.3%',
      icon: 'users',
      tone: 'green',
    },
    {
      label: 'Lượt đọc hôm nay',
      value: '245,678',
      comparison: '21.4%',
      icon: 'eye',
      tone: 'orange',
    },
  ];

  readonly systemStatuses: readonly SystemStatus[] = [
    { label: 'Máy chủ web', icon: 'server' },
    { label: 'Cơ sở dữ liệu', icon: 'database' },
    { label: 'Bộ nhớ', icon: 'hard-drive' },
    { label: 'Sao lưu dữ liệu', icon: 'archive' },
  ];

  readonly activities: readonly ActivityItem[] = [
    {
      actor: 'Nguyễn Minh Anh',
      action: 'đã đăng truyện mới',
      detail: 'Tiên Nghịch · Tập 1245',
      time: '2 phút trước',
      avatar: 'MA',
      tone: 'violet',
    },
    {
      actor: 'Lê Hoàng',
      action: 'đã cập nhật chương',
      detail: 'Võ Thần Chúa Tể · Chương 856',
      time: '15 phút trước',
      avatar: 'LH',
      tone: 'green',
    },
    {
      actor: 'Trần Văn Nam',
      action: 'đã đăng ký tài khoản mới',
      detail: 'Thành viên Reader',
      time: '23 phút trước',
      avatar: 'VN',
      tone: 'orange',
    },
    {
      actor: 'Phạm Thị Lan',
      action: 'đã bình luận',
      detail: 'Đấu Phá Thương Khung · Chương 112',
      time: '35 phút trước',
      avatar: 'PL',
      tone: 'blue',
    },
  ];

  readonly stories: readonly StoryRow[] = [
    {
      title: 'Tiên Nghịch',
      chapter: 'Tập 1245',
      author: 'Nhĩ Căn',
      genre: 'Tiên Hiệp',
      genreTone: 'violet',
      status: 'Đang đăng',
      statusTone: 'green',
      views: '2.4M',
      updatedAt: '5 phút trước',
      coverClass: 'cover-one',
      coverText: 'TN',
    },
    {
      title: 'Võ Thần Chúa Tể',
      chapter: 'Chương 856',
      author: 'Vô Thượng',
      genre: 'Huyền Huyễn',
      genreTone: 'blue',
      status: 'Đang đăng',
      statusTone: 'green',
      views: '1.8M',
      updatedAt: '15 phút trước',
      coverClass: 'cover-two',
      coverText: 'VT',
    },
    {
      title: 'Đấu Phá Thương Khung',
      chapter: 'Chương 112',
      author: 'Thiên Tằm Thổ Đậu',
      genre: 'Võ Hiệp',
      genreTone: 'orange',
      status: 'Hoàn thành',
      statusTone: 'blue',
      views: '3.7M',
      updatedAt: '35 phút trước',
      coverClass: 'cover-three',
      coverText: 'ĐP',
    },
    {
      title: 'Thần Đạo Đan Tôn',
      chapter: 'Chương 678',
      author: 'Ngã Cật Tây Hồng Thị',
      genre: 'Huyền Huyễn',
      genreTone: 'blue',
      status: 'Bản nháp',
      statusTone: 'gray',
      views: '456K',
      updatedAt: '1 giờ trước',
      coverClass: 'cover-four',
      coverText: 'TĐ',
    },
    {
      title: 'Nhất Niệm Vĩnh Hằng',
      chapter: 'Chương 512',
      author: 'Nhĩ Căn',
      genre: 'Tiên Hiệp',
      genreTone: 'violet',
      status: 'Đang đăng',
      statusTone: 'green',
      views: '980K',
      updatedAt: '2 giờ trước',
      coverClass: 'cover-five',
      coverText: 'NN',
    },
  ];

  private readonly chartSeries: Readonly<Record<string, readonly number[]>> = {
    '7 ngày': [52, 68, 61, 82, 74, 91, 86],
    '30 ngày': [
      42, 57, 44, 61, 50, 76, 72, 83, 48, 91, 77, 55,
      60, 69, 73, 96, 62, 75, 79, 59, 88, 74, 63, 54,
      71, 98, 87, 79, 99, 70,
    ],
    '90 ngày': [
      37, 54, 49, 68, 58, 75, 65, 81, 70, 89, 74, 61,
      79, 83, 69, 92, 81, 95,
    ],
    '1 năm': [42, 48, 59, 53, 67, 72, 63, 78, 84, 76, 91, 96],
  };

  readonly chartPoints = computed(() => {
    const values = this.chartSeries[this.selectedRange()];
    const width = 720;
    const height = 160;
    const top = 10;
    const left = 8;
    const max = 110;
    const step = width / Math.max(values.length - 1, 1);

    return values
      .map((value, index) => {
        const x = left + index * step;
        const y = top + height - (value / max) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  readonly chartAreaPoints = computed(() => {
    return `8,180 ${this.chartPoints()} 728,180`;
  });

  readonly chartBars = computed<readonly ChartBar[]>(() => {
    const values = this.chartSeries[this.selectedRange()];
    const width = 720;
    const bottom = 204;
    const maxHeight = 46;
    const count = values.length;
    const step = width / count;
    const barWidth = Math.max(4, Math.min(12, step * 0.55));

    return values.map((value, index) => {
      const height = 12 + ((value * 1.37 + index * 7) % maxHeight);
      return {
        x: 8 + index * step + (step - barWidth) / 2,
        y: bottom - height,
        height,
      };
    });
  });

  setRange(range: string): void {
    this.selectedRange.set(range);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((isOpen) => !isOpen);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}