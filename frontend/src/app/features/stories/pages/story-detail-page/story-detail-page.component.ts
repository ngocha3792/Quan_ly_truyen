import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { PortalIconComponent } from '../../../../shared/ui/portal-icon/portal-icon.component';

interface DetailChapter {
  readonly number: string;
  readonly title: string;
  readonly updated: string;
  readonly isNew?: boolean;
}

interface DetailComment {
  readonly name: string;
  readonly role?: string;
  readonly time: string;
  readonly content: string;
  readonly likes: string;
  readonly avatar: string;
}

interface DetailStory {
  readonly title: string;
  readonly author: string;
  readonly views: string;
  readonly image: string;
}

@Component({
  selector: 'app-story-detail-page',
  standalone: true,
  imports: [PortalIconComponent],
  templateUrl: './story-detail-page.component.html',
  styleUrls: ['./story-detail-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryDetailPageComponent {
  readonly menuOpen = signal(false);
  readonly following = signal(false);
  readonly inLibrary = signal(false);
  readonly synopsisExpanded = signal(false);
  readonly chapterSearch = signal('');

  readonly chapters: readonly DetailChapter[] = [
    {
      number: '1279',
      title: 'Kiếp này, ta chỉ cầu một niệm vô địch',
      updated: 'Hôm nay 20:00',
      isNew: true,
    },
    {
      number: '1278',
      title: 'Thánh địa chi chiến, phong vân lắng',
      updated: 'Hôm qua 20:00',
    },
    {
      number: '1277',
      title: 'Hỗn độn chi lực, vực sâu trỗi dậy',
      updated: '2 ngày trước 20:00',
    },
  ];

  readonly comments: readonly DetailComment[] = [
    {
      name: 'Vô Danh Kiếm Khách',
      role: 'VIP',
      time: '2 ngày trước',
      content:
        'Truyện quá hay! Mỗi chương đều hấp dẫn, tác giả xây dựng thế giới rất chi tiết.',
      likes: '128',
      avatar: '/assets/story-detail/avatar-1.svg',
    },
    {
      name: 'Thiên Đạo Hữu Tình',
      time: '1 ngày trước',
      content:
        'Lâm Huyền quá ngầu! Càng đọc càng cuốn, hóng chương mới mỗi ngày!',
      likes: '96',
      avatar: '/assets/story-detail/avatar-2.svg',
    },
    {
      name: 'Mộng Ảo Tiên Tôn',
      time: '3 ngày trước',
      content: 'Đại đạo chí tôn, danh xứng với thực!',
      likes: '72',
      avatar: '/assets/story-detail/avatar-3.svg',
    },
  ];

  readonly similarStories: readonly DetailStory[] = [
    {
      title: 'Thần Đạo Đan Tôn',
      author: 'Cô Đơn Địa Phi',
      views: '8.7M',
      image: '/assets/story-detail/thumb-1.svg',
    },
    {
      title: 'Vạn Cổ Thần Đế',
      author: 'Phi Thiên Ngư',
      views: '7.3M',
      image: '/assets/story-detail/thumb-2.svg',
    },
    {
      title: 'Nguyên Tôn',
      author: 'Thiên Tằm Thổ Đậu',
      views: '6.9M',
      image: '/assets/story-detail/thumb-3.svg',
    },
    {
      title: 'Tu Tiên Giả Đại Chiến',
      author: 'Dạ Tử Vũ',
      views: '5.6M',
      image: '/assets/story-detail/thumb-4.svg',
    },
  ];

  readonly rankings: readonly DetailStory[] = [
    {
      title: 'Đại Đạo Chí Tôn',
      author: 'Mặc Hương Đồng Khứu',
      views: '12.5M',
      image: '/assets/story-detail/cover-main.svg',
    },
    ...this.similarStories,
  ];

  toggleMenu(): void {
    this.menuOpen.update((isOpen) => !isOpen);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleFollow(): void {
    this.following.update((isFollowing) => !isFollowing);
  }

  toggleLibrary(): void {
    this.inLibrary.update((saved) => !saved);
  }

  toggleSynopsis(): void {
    this.synopsisExpanded.update((expanded) => !expanded);
  }

  updateChapterSearch(event: Event): void {
    this.chapterSearch.set((event.target as HTMLInputElement).value);
  }
}
