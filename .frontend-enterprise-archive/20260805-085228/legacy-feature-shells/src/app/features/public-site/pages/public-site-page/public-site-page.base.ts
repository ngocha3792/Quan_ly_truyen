import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../../../shared/ui/public-site-icon/public-site-icon.component';

type PublicPageKey =
  | 'home'
  | 'genres'
  | 'search'
  | 'rankings'
  | 'story'
  | 'chapters'
  | 'reader'
  | 'comments'
  | 'author'
  | 'about'
  | 'guide'
  | 'notFound';
interface StoryCard {
  readonly id: number;
  readonly title: string;
  readonly author: string;
  readonly genre: string;
  readonly chapter: string;
  readonly reads: string;
  readonly rating: string;
  readonly status: string;
  readonly image: string;
}
interface GenreCard {
  readonly name: string;
  readonly count: string;
  readonly icon: string;
}
interface ChapterItem {
  readonly number: number;
  readonly title: string;
  readonly date: string;
}
interface CommentItem {
  readonly name: string;
  readonly time: string;
  readonly content: string;
  readonly likes: string;
  readonly avatar: string;
}

export abstract class PublicSitePageBase {
  private readonly route = inject(ActivatedRoute);
  readonly mobileNavOpen = signal(false);
  readonly chapterPanelOpen = signal(false);
  readonly readerSettingsOpen = signal(false);
  readonly activeRanking = signal('Tổng hợp');
  readonly activeGuide = signal('Hướng dẫn đọc truyện');
  readonly fontSize = signal(17);
  readonly bookmarked = signal(false);
  readonly page = computed<PublicPageKey>(() => {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    if (path === '') return 'home';
    if (path === 'genres') return 'genres';
    if (path === 'search') return 'search';
    if (path === 'rankings') return 'rankings';
    if (path === 'story/:slug/chapters') return 'chapters';
    if (path === 'read/:slug/:chapter') return 'reader';
    if (path === 'story/:slug/chapter/:chapter/comments') return 'comments';
    if (path === 'authors/:slug') return 'author';
    if (path === 'about') return 'about';
    if (path === 'guide') return 'guide';
    if (path === '404') return 'notFound';
    if (path === 'story/:slug') return 'story';
    return 'notFound';
  });
  readonly stories: readonly StoryCard[] = [
    {
      id: 1,
      title: 'Đại Đạo Chí Tôn',
      author: 'Mặc Hương Đồng Khứu',
      genre: 'Tiên hiệp',
      chapter: 'Chương 1278',
      reads: '12.5M',
      rating: '4.9',
      status: 'Đang ra',
      image: '/assets/public-site/cover-1.svg',
    },
    {
      id: 2,
      title: 'Võ Đạo Đỉnh Phong',
      author: 'Mạc Mặc',
      genre: 'Huyền huyễn',
      chapter: 'Chương 987',
      reads: '8.7M',
      rating: '4.8',
      status: 'Đang ra',
      image: '/assets/public-site/cover-2.svg',
    },
    {
      id: 3,
      title: 'Toàn Chức Pháp Sư',
      author: 'Loạn',
      genre: 'Huyền huyễn',
      chapter: 'Chương 612',
      reads: '7.2M',
      rating: '4.7',
      status: 'Hoàn thành',
      image: '/assets/public-site/cover-3.svg',
    },
    {
      id: 4,
      title: 'Đấu Phá Thương Khung',
      author: 'Thiên Tằm Thổ Đậu',
      genre: 'Huyền huyễn',
      chapter: 'Chương 1432',
      reads: '6.1M',
      rating: '4.8',
      status: 'Hoàn thành',
      image: '/assets/public-site/cover-4.svg',
    },
    {
      id: 5,
      title: 'Vạn Cổ Thần Đế',
      author: 'Phi Thiên Ngư',
      genre: 'Tiên hiệp',
      chapter: 'Chương 1150',
      reads: '5.3M',
      rating: '4.7',
      status: 'Đang ra',
      image: '/assets/public-site/cover-5.svg',
    },
    {
      id: 6,
      title: 'Đấu Tinh Ở Đô Thị',
      author: 'Tân Phong',
      genre: 'Đô thị',
      chapter: 'Chương 158',
      reads: '4.5M',
      rating: '4.6',
      status: 'Đang ra',
      image: '/assets/public-site/cover-6.svg',
    },
    {
      id: 7,
      title: 'Một Mình Ta Độc Hành',
      author: 'Huyền Thiên',
      genre: 'Khoa huyễn',
      chapter: 'Chương 999',
      reads: '4.1M',
      rating: '4.6',
      status: 'Hoàn thành',
      image: '/assets/public-site/cover-7.svg',
    },
    {
      id: 8,
      title: 'Ta Là Đại Thần Tiên',
      author: 'Đại Lão',
      genre: 'Hệ thống',
      chapter: 'Chương 721',
      reads: '3.2M',
      rating: '4.5',
      status: 'Đang ra',
      image: '/assets/public-site/cover-8.svg',
    },
  ];
  readonly genres: readonly GenreCard[] = [
    { name: 'Tiên Hiệp', count: '3,456 truyện', icon: '仙' },
    { name: 'Kiếm Hiệp', count: '1,234 truyện', icon: '剑' },
    { name: 'Huyền Huyễn', count: '2,345 truyện', icon: '玄' },
    { name: 'Đô Thị', count: '2,345 truyện', icon: '城' },
    { name: 'Lịch Sử', count: '1,234 truyện', icon: '史' },
    { name: 'Khoa Huyễn', count: '987 truyện', icon: '科' },
    { name: 'Hệ Thống', count: '1,876 truyện', icon: '统' },
    { name: 'Dị Năng', count: '1,234 truyện', icon: '能' },
    { name: 'Trọng Sinh', count: '987 truyện', icon: '生' },
    { name: 'Ngôn Tình', count: '2,456 truyện', icon: '情' },
    { name: 'Truyện Teen', count: '1,234 truyện', icon: '青' },
    { name: 'Khác', count: '3,210 truyện', icon: '杂' },
  ];
  readonly chapters: readonly ChapterItem[] = [
    { number: 1278, title: 'Đại chiến Thiên Vực', date: '22/05/2024 10:30' },
    { number: 1277, title: 'Thiên Hồn gặp thần kiếm', date: '21/05/2024 10:30' },
    { number: 1276, title: 'Thiên địa đổi mới', date: '20/05/2024 10:30' },
    { number: 1275, title: 'Dòng sức cấm kỳ', date: '19/05/2024 10:30' },
    { number: 1274, title: 'Thánh thần chi chiến', date: '18/05/2024 10:30' },
    { number: 1273, title: 'Đế quân xuất hiện', date: '17/05/2024 10:30' },
    { number: 1272, title: 'Kỳ ngộ bí cảnh', date: '16/05/2024 10:30' },
    { number: 1271, title: 'Một bước mai một', date: '15/05/2024 10:30' },
    { number: 1270, title: 'Chân thần chỉ đạo', date: '14/05/2024 10:30' },
    { number: 1269, title: 'Thăm dò', date: '13/05/2024 10:30' },
  ];
  readonly comments: readonly CommentItem[] = [
    {
      name: 'Thần Tiên Tỷ Tỷ',
      time: '7 phút trước',
      content: 'Đại chiến quá hay! Không biết Diệp Huyền có thể thắng không nữa 😮',
      likes: '152',
      avatar: '/assets/public-site/avatar-1.svg',
    },
    {
      name: 'Huyền Nhi',
      time: '9 phút trước',
      content: 'Chắc chắn rồi! Main không bao giờ thua đâu 😄',
      likes: '66',
      avatar: '/assets/public-site/avatar-2.svg',
    },
    {
      name: 'Kiếm Khách',
      time: '3 phút trước',
      content: 'Đọc mà nổi da gà! Tác giả viết quá đỉnh!',
      likes: '98',
      avatar: '/assets/public-site/avatar-3.svg',
    },
  ];
  increaseFont(): void {
    this.fontSize.update((size) => Math.min(size + 1, 22));
  }
  decreaseFont(): void {
    this.fontSize.update((size) => Math.max(size - 1, 13));
  }
  goBack(): void {
    history.back();
  }
}
