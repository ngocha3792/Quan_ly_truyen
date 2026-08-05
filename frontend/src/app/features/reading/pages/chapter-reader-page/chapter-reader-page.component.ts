import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { ReaderAccountIconComponent } from '../../../../shared/ui/reader-account-icon/reader-account-icon.component';

interface ReaderChapter {
  readonly number: number;
  readonly title: string;
  readonly current?: boolean;
  readonly completed?: boolean;
}

interface ReaderVolume {
  readonly name: string;
  readonly expanded: boolean;
  readonly chapters: readonly ReaderChapter[];
}

interface ReaderComment {
  readonly name: string;
  readonly time: string;
  readonly content: string;
  readonly likes: string;
  readonly avatar: string;
}

@Component({
  selector: 'app-chapter-reader-page',
  standalone: true,
  imports: [ReaderAccountIconComponent],
  templateUrl: './chapter-reader-page.component.html',
  styleUrls: ['./chapter-reader-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterReaderPageComponent {
  readonly leftPanelOpen = signal(false);
  readonly rightPanelOpen = signal(false);
  readonly fontSize = signal(16);
  readonly fontFamily = signal('Be Vietnam Pro');
  readonly background = signal('dark');
  readonly lineSpacing = signal('normal');
  readonly pageWidth = signal('medium');
  readonly autoScroll = signal(false);
  readonly bookmarked = signal(false);

  readonly volumes: readonly ReaderVolume[] = [
    {
      name: 'Quyển 1: Thần Ma Loạn Thế',
      expanded: true,
      chapters: [
        { number: 1, title: 'Thiếu niên Lâm Phàm' },
        { number: 2, title: 'Ngọc Bội Không Gian' },
        { number: 3, title: 'Linh căn bị phế', completed: true },
        { number: 4, title: 'Khí huyết kích hoạt' },
        { number: 5, title: 'Võ Hồn thức tỉnh' },
        { number: 6, title: 'Ngoại môn khảo hạch' },
        { number: 7, title: 'Trận chiến đầu tiên' },
        { number: 8, title: 'Đột phá Huyền khí' },
        { number: 9, title: 'Bí cảnh thử luyện' },
        { number: 10, title: 'Thu hoạch lớn' },
      ],
    },
    {
      name: 'Quyển 2: Vạn Tộc Tranh Bá',
      expanded: false,
      chapters: [],
    },
    {
      name: 'Quyển 3: Thần Vực Chi Chiến',
      expanded: false,
      chapters: [],
    },
    {
      name: 'Quyển 4: Vô Thượng Đại Đạo',
      expanded: false,
      chapters: [],
    },
  ];

  readonly comments: readonly ReaderComment[] = [
    {
      name: 'Thiên Vô Cực',
      time: '2 giờ trước',
      content: 'Đột phá quá đỉnh! Hóng chương sau!',
      likes: '128',
      avatar: '/assets/chapter-reader/comment-1.svg',
    },
    {
      name: 'Linh Nhi',
      time: '3 giờ trước',
      content: 'Main bá quá, kịch bản cuốn thật sự!',
      likes: '96',
      avatar: '/assets/chapter-reader/comment-2.svg',
    },
    {
      name: 'Đại Ma Vương',
      time: '5 giờ trước',
      content: 'Hay! Tác giả viết đỉnh quá!',
      likes: '76',
      avatar: '/assets/chapter-reader/comment-3.svg',
    },
  ];

  readonly readerClasses = computed(() =>
    [
      `reader-font-${this.fontSize()}`,
      `reader-family-${this.fontFamily().replaceAll(' ', '-').toLowerCase()}`,
      `reader-bg-${this.background()}`,
      `reader-line-${this.lineSpacing()}`,
      `reader-width-${this.pageWidth()}`,
    ].join(' '),
  );

  increaseFont(): void {
    this.fontSize.update((value) => Math.min(value + 1, 22));
  }

  decreaseFont(): void {
    this.fontSize.update((value) => Math.max(value - 1, 13));
  }

  setBackground(value: string): void {
    this.background.set(value);
  }

  setLineSpacing(value: string): void {
    this.lineSpacing.set(value);
  }

  setPageWidth(value: string): void {
    this.pageWidth.set(value);
  }

  toggleAutoScroll(): void {
    this.autoScroll.update((enabled) => !enabled);
  }

  toggleBookmark(): void {
    this.bookmarked.update((saved) => !saved);
  }

  toggleLeftPanel(): void {
    this.leftPanelOpen.update((open) => !open);
  }

  toggleRightPanel(): void {
    this.rightPanelOpen.update((open) => !open);
  }

  closePanels(): void {
    this.leftPanelOpen.set(false);
    this.rightPanelOpen.set(false);
  }
}
