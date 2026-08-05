import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  SiteIconComponent,
  SiteIconName,
} from '../../../../shared/ui/site-icon/site-icon.component';

interface HeroStory {
  readonly slug: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly author: string;
  readonly chapters: string;
  readonly rating: string;
  readonly image: string;
}

interface Shortcut {
  readonly label: string;
  readonly description: string;
  readonly icon: SiteIconName;
  readonly tone: string;
}

interface StoryCard {
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly genre: string;
  readonly chapters: string;
  readonly rating: string;
  readonly image: string;
}

interface RankedStory {
  readonly title: string;
  readonly genre: string;
  readonly views: string;
  readonly image: string;
}

interface UpdatedStory {
  readonly title: string;
  readonly chapter: string;
  readonly time: string;
  readonly image: string;
}

interface Category {
  readonly name: string;
  readonly count: string;
  readonly icon: SiteIconName;
  readonly tone: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [SiteIconComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly darkMode = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly currentHeroIndex = signal(0);
  readonly searchTerm = signal('');
  readonly favorites = signal<ReadonlySet<string>>(new Set());

  readonly heroes: readonly HeroStory[] = [
    {
      slug: 'dai-dao-chi-ton',
      eyebrow: 'TIÊN HIỆP',
      title: 'Đại Đạo Chí Tôn',
      description:
        'Thiên địa là lò luyện, vạn vật là vật liệu. Ta từ phàm tục mà lên, lấy đại đạo chứng chí tôn!',
      author: 'Mặc Hương Đồng Khứu',
      chapters: '1.234 chương',
      rating: '4.9',
      image: '/assets/home/hero-1.svg',
    },
    {
      slug: 'vo-dao-chi-ton',
      eyebrow: 'HUYỀN HUYỄN',
      title: 'Võ Đạo Chí Tôn',
      description:
        'Một thiếu niên bước ra từ vực sâu, dùng đôi tay phá tan xiềng xích của định mệnh.',
      author: 'Mộng Nhập Thần Cơ',
      chapters: '987 chương',
      rating: '4.8',
      image: '/assets/home/hero-2.svg',
    },
    {
      slug: 'thien-kiep-chi-chu',
      eyebrow: 'TIÊN HIỆP',
      title: 'Thiên Kiếp Chi Chủ',
      description:
        'Vạn kiếp giáng xuống, chỉ một người dám ngẩng đầu và hỏi trời cao ai mới là chủ nhân.',
      author: 'Vân Tiêu Lão Quái',
      chapters: '856 chương',
      rating: '4.8',
      image: '/assets/home/hero-3.svg',
    },
  ];

  readonly hero = computed(() => this.heroes[this.currentHeroIndex()]);

  readonly shortcuts: readonly Shortcut[] = [
    {
      label: 'Hot',
      description: 'Truyện hot',
      icon: 'fire',
      tone: 'violet',
    },
    {
      label: 'Top',
      description: 'Bảng xếp hạng',
      icon: 'ranking',
      tone: 'blue',
    },
    {
      label: 'Mới cập nhật',
      description: 'Truyện mới',
      icon: 'book',
      tone: 'green',
    },
    {
      label: 'Yêu thích',
      description: 'Dành cho bạn',
      icon: 'star',
      tone: 'orange',
    },
    {
      label: 'Theo dõi',
      description: 'Tác giả yêu thích',
      icon: 'heart',
      tone: 'pink',
    },
    {
      label: 'Thể loại',
      description: 'Khám phá',
      icon: 'grid',
      tone: 'cyan',
    },
  ];

  readonly hotStories: readonly StoryCard[] = [
    {
      slug: 'dai-dao-chi-ton',
      title: 'Đại Đạo Chí Tôn',
      author: 'Mặc Hương Đồng Khứu',
      genre: 'Tiên hiệp',
      chapters: '1.234 chương',
      rating: '4.9',
      image: '/assets/home/cover-1.svg',
    },
    {
      slug: 'vo-dao-chi-ton',
      title: 'Võ Đạo Chí Tôn',
      author: 'Mộng Nhập Thần Cơ',
      genre: 'Huyền huyễn',
      chapters: '987 chương',
      rating: '4.8',
      image: '/assets/home/cover-2.svg',
    },
    {
      slug: 'thien-kiep-chi-chu',
      title: 'Thiên Kiếp Chi Chủ',
      author: 'Vân Tiêu Lão Quái',
      genre: 'Tiên hiệp',
      chapters: '856 chương',
      rating: '4.8',
      image: '/assets/home/cover-3.svg',
    },
    {
      slug: 'tu-linh-phap-su',
      title: 'Tử Linh Pháp Sư',
      author: 'Dạ Mặc',
      genre: 'Huyền huyễn',
      chapters: '743 chương',
      rating: '4.7',
      image: '/assets/home/cover-4.svg',
    },
    {
      slug: 'tien-nghich',
      title: 'Tiên Nghịch',
      author: 'Nhĩ Căn',
      genre: 'Tiên hiệp',
      chapters: '2.076 chương',
      rating: '4.7',
      image: '/assets/home/cover-5.svg',
    },
    {
      slug: 'than-an-vuong-toa',
      title: 'Thần Ấn Vương Tọa',
      author: 'Đường Gia Tam Thiếu',
      genre: 'Huyền huyễn',
      chapters: '1.123 chương',
      rating: '4.6',
      image: '/assets/home/cover-6.svg',
    },
  ];

  readonly topStories: readonly RankedStory[] = [
    {
      title: 'Đại Đạo Chí Tôn',
      genre: 'Tiên hiệp',
      views: '125.6K',
      image: '/assets/home/cover-1.svg',
    },
    {
      title: 'Võ Đạo Chí Tôn',
      genre: 'Huyền huyễn',
      views: '98.3K',
      image: '/assets/home/cover-2.svg',
    },
    {
      title: 'Thiên Kiếp Chi Chủ',
      genre: 'Tiên hiệp',
      views: '76.1K',
      image: '/assets/home/cover-3.svg',
    },
    {
      title: 'Tử Linh Pháp Sư',
      genre: 'Huyền huyễn',
      views: '64.2K',
      image: '/assets/home/cover-4.svg',
    },
    {
      title: 'Tiên Nghịch',
      genre: 'Tiên hiệp',
      views: '61.8K',
      image: '/assets/home/cover-5.svg',
    },
  ];

  readonly updatedStories: readonly UpdatedStory[] = [
    {
      title: 'Toàn Chức Pháp Sư',
      chapter: 'Chương 1200: Dấu vết',
      time: '2 phút trước',
      image: '/assets/home/cover-3.svg',
    },
    {
      title: 'Đấu Phá Thương Khung',
      chapter: 'Chương 1645: Thu phục Hồn Điện',
      time: '12 phút trước',
      image: '/assets/home/cover-4.svg',
    },
    {
      title: 'Đại Chúa Tể',
      chapter: 'Chương 1005: Thiên Linh Thánh Thể',
      time: '28 phút trước',
      image: '/assets/home/cover-6.svg',
    },
  ];

  readonly categories: readonly Category[] = [
    {
      name: 'Tiên hiệp',
      count: '2.345 truyện',
      icon: 'sparkles',
      tone: 'violet',
    },
    {
      name: 'Huyền huyễn',
      count: '3.456 truyện',
      icon: 'fire',
      tone: 'blue',
    },
    {
      name: 'Đô thị',
      count: '1.234 truyện',
      icon: 'book',
      tone: 'green',
    },
    {
      name: 'Lịch sử',
      count: '987 truyện',
      icon: 'history',
      tone: 'orange',
    },
    {
      name: 'Khoa huyễn',
      count: '765 truyện',
      icon: 'sparkles',
      tone: 'violet',
    },
    {
      name: 'Trọng sinh',
      count: '543 truyện',
      icon: 'history',
      tone: 'pink',
    },
    {
      name: 'Khác',
      count: '1.234 truyện',
      icon: 'grid',
      tone: 'gray',
    },
  ];

  nextHero(): void {
    this.currentHeroIndex.update(
      (index) => (index + 1) % this.heroes.length,
    );
  }

  previousHero(): void {
    this.currentHeroIndex.update(
      (index) => (index - 1 + this.heroes.length) % this.heroes.length,
    );
  }

  selectHero(index: number): void {
    this.currentHeroIndex.set(index);
  }

  toggleTheme(): void {
    this.darkMode.update((isDark) => !isDark);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((isOpen) => !isOpen);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleFavorite(slug: string): void {
    this.favorites.update((current) => {
      const next = new Set(current);

      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }

      return next;
    });
  }

  isFavorite(slug: string): boolean {
    return this.favorites().has(slug);
  }

  updateSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }
}
