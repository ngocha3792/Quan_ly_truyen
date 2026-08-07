import { StoryCatalogItem, StoryGenre } from '../domain/story-catalog.models';

export const STORY_GENRES_MOCK: readonly StoryGenre[] = [
  {
    id: 'genre-action',
    slug: 'hanh-dong',
    name: 'Hành động',
  },
  {
    id: 'genre-fantasy',
    slug: 'fantasy',
    name: 'Fantasy',
  },
  {
    id: 'genre-romance',
    slug: 'romance',
    name: 'Romance',
  },
  {
    id: 'genre-comedy',
    slug: 'hai-huoc',
    name: 'Hài hước',
  },
  {
    id: 'genre-manhwa',
    slug: 'manhwa',
    name: 'Manhwa',
  },
  {
    id: 'genre-manhua',
    slug: 'manhua',
    name: 'Manhua',
  },
  {
    id: 'genre-drama',
    slug: 'drama',
    name: 'Drama',
  },
  {
    id: 'genre-horror',
    slug: 'kinh-di',
    name: 'Kinh dị',
  },
];

export const STORY_CATALOG_MOCK: readonly StoryCatalogItem[] = [
  {
    id: 'story-001',
    slug: 'dai-chien-ma-vuong',

    title: 'Đại Chiến Ma Vương',
    authorName: 'Hải Vô Nhai',

    description:
      'Một thiếu niên thức tỉnh sức mạnh ma vương và bước vào cuộc chiến thay đổi thế giới.',

    coverUrl: '/assets/mock/stories/dai-chien-ma-vuong.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'fantasy',
        name: 'Fantasy',
      },
    ],

    status: 'ongoing',
    badge: 'HOT',

    latestChapter: 256,
    chapterCount: 256,

    views: 18_300_000,
    rating: 9.4,

    releaseYear: 2024,
    updatedAt: '2026-08-05T09:10:00.000Z',
  },
  {
    id: 'story-002',
    slug: 'toi-la-tan-thu-duy-nhat',

    title: 'Tôi Là Tân Thủ Duy Nhất',
    authorName: 'Kim Dong Young',

    description: 'Người chơi cuối cùng còn nhớ toàn bộ bí mật của trò chơi tử thần.',

    coverUrl: '/assets/mock/stories/toi-la-tan-thu-duy-nhat.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'fantasy',
        name: 'Isekai',
      },
    ],

    status: 'ongoing',
    badge: 'NEW',

    latestChapter: 58,
    chapterCount: 58,

    views: 8_600_000,
    rating: 8.7,

    releaseYear: 2025,
    updatedAt: '2026-08-05T08:32:00.000Z',
  },
  {
    id: 'story-003',
    slug: 'thanh-guom-diet-quy',

    title: 'Thanh Gươm Diệt Quỷ',
    authorName: 'Koyoharu Gotouge',

    description: 'Hành trình chiến đấu chống lại quỷ dữ của một kiếm sĩ trẻ.',

    coverUrl: '/assets/mock/stories/thanh-guom-diet-quy.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'fantasy',
        name: 'Dark Fantasy',
      },
    ],

    status: 'completed',
    badge: 'HOT',

    latestChapter: 205,
    chapterCount: 205,

    views: 12_400_000,
    rating: 9.2,

    releaseYear: 2016,
    updatedAt: '2026-08-04T16:00:00.000Z',
  },
  {
    id: 'story-004',
    slug: 'so-huu-suc-manh-vo-han',

    title: 'Sở Hữu Sức Mạnh Vô Hạn',
    authorName: 'Lee Han',

    description: 'Hệ thống bí ẩn giúp nhân vật chính sao chép mọi kỹ năng.',

    coverUrl: '/assets/mock/stories/so-huu-suc-manh-vo-han.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'fantasy',
        name: 'Fantasy',
      },
    ],

    status: 'ongoing',
    badge: 'NEW',

    latestChapter: 73,
    chapterCount: 73,

    views: 6_800_000,
    rating: 8.9,

    releaseYear: 2025,
    updatedAt: '2026-08-04T14:30:00.000Z',
  },
  {
    id: 'story-005',
    slug: 'thoi-gian-de-yeu-em',

    title: 'Thời Gian Để Yêu Em',
    authorName: 'Han Ji Woo',

    description: 'Một câu chuyện tình cảm nhẹ nhàng giữa hai con người bị thời gian chia cắt.',

    coverUrl: '/assets/mock/stories/thoi-gian-de-yeu-em.webp',

    genres: [
      {
        slug: 'romance',
        name: 'Romance',
      },
      {
        slug: 'drama',
        name: 'Drama',
      },
    ],

    status: 'completed',
    badge: 'FULL',

    latestChapter: 120,
    chapterCount: 120,

    views: 9_100_000,
    rating: 9.0,

    releaseYear: 2022,
    updatedAt: '2026-08-03T12:20:00.000Z',
  },
  {
    id: 'story-006',
    slug: 'tokyo-ghoul',

    title: 'Tokyo Ghoul',
    authorName: 'Sui Ishida',

    description: 'Một sinh viên bị biến đổi thành bán quỷ và phải sống giữa hai thế giới.',

    coverUrl: '/assets/mock/stories/tokyo-ghoul.webp',

    genres: [
      {
        slug: 'kinh-di',
        name: 'Horror',
      },
      {
        slug: 'drama',
        name: 'Psychological',
      },
    ],

    status: 'completed',
    badge: 'HOT',

    latestChapter: 179,
    chapterCount: 179,

    views: 7_200_000,
    rating: 8.8,

    releaseYear: 2011,
    updatedAt: '2026-08-02T10:00:00.000Z',
  },
  {
    id: 'story-007',
    slug: 'vo-luyen-dinh-phong',

    title: 'Võ Luyện Đỉnh Phong',
    authorName: 'Mạc Mặc',

    description: 'Con đường võ đạo không có điểm dừng, từng bước tiến đến đỉnh phong.',

    coverUrl: '/assets/mock/stories/vo-luyen-dinh-phong.webp',

    genres: [
      {
        slug: 'manhua',
        name: 'Manhua',
      },
      {
        slug: 'hanh-dong',
        name: 'Martial Arts',
      },
    ],

    status: 'ongoing',
    badge: 'NEW',

    latestChapter: 314,
    chapterCount: 314,

    views: 5_300_000,
    rating: 8.5,

    releaseYear: 2018,
    updatedAt: '2026-08-02T08:20:00.000Z',
  },
  {
    id: 'story-008',
    slug: 'naruto',

    title: 'Naruto',
    authorName: 'Masashi Kishimoto',

    description: 'Cậu bé ninja bị cả làng xa lánh quyết tâm trở thành Hokage.',

    coverUrl: '/assets/mock/stories/naruto.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'hai-huoc',
        name: 'Adventure',
      },
    ],

    status: 'completed',
    badge: 'HOT',

    latestChapter: 700,
    chapterCount: 700,

    views: 18_700_000,
    rating: 9.1,

    releaseYear: 1999,
    updatedAt: '2026-08-01T19:00:00.000Z',
  },
  {
    id: 'story-009',
    slug: 'attack-on-titan',

    title: 'Attack on Titan',
    authorName: 'Hajime Isayama',

    description: 'Nhân loại sống sau những bức tường khổng lồ để chống lại Titan.',

    coverUrl: '/assets/mock/stories/attack-on-titan.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'drama',
        name: 'Drama',
      },
    ],

    status: 'completed',
    badge: 'FULL',

    latestChapter: 139,
    chapterCount: 139,

    views: 16_200_000,
    rating: 9.5,

    releaseYear: 2009,
    updatedAt: '2026-07-31T18:00:00.000Z',
  },
  {
    id: 'story-010',
    slug: 'solo-leveling',

    title: 'Solo Leveling',
    authorName: 'Chugong',

    description: 'Thợ săn yếu nhất thế giới nhận được hệ thống cho phép tăng cấp vô hạn.',

    coverUrl: '/assets/mock/stories/solo-leveling.webp',

    genres: [
      {
        slug: 'manhwa',
        name: 'Manhwa',
      },
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
    ],

    status: 'completed',
    badge: 'NEW',

    latestChapter: 181,
    chapterCount: 181,

    views: 23_100_000,
    rating: 9.7,

    releaseYear: 2018,
    updatedAt: '2026-07-30T15:00:00.000Z',
  },
  {
    id: 'story-011',
    slug: 'one-piece',

    title: 'One Piece',
    authorName: 'Eiichiro Oda',

    description: 'Cuộc hành trình tìm kiếm kho báu One Piece của băng Mũ Rơm.',

    coverUrl: '/assets/mock/stories/one-piece.webp',

    genres: [
      {
        slug: 'hanh-dong',
        name: 'Action',
      },
      {
        slug: 'hai-huoc',
        name: 'Adventure',
      },
    ],

    status: 'ongoing',
    badge: 'HOT',

    latestChapter: 1105,
    chapterCount: 1105,

    views: 24_800_000,
    rating: 9.2,

    releaseYear: 1997,
    updatedAt: '2026-07-29T10:00:00.000Z',
  },
  {
    id: 'story-012',
    slug: 'death-note',

    title: 'Death Note',
    authorName: 'Tsugumi Ohba',

    description: 'Một cuốn sổ bí ẩn cho phép người sở hữu quyết định cái chết của người khác.',

    coverUrl: '/assets/mock/stories/death-note.webp',

    genres: [
      {
        slug: 'drama',
        name: 'Mystery',
      },
      {
        slug: 'kinh-di',
        name: 'Psychological',
      },
    ],

    status: 'completed',
    badge: 'FULL',

    latestChapter: 108,
    chapterCount: 108,

    views: 8_900_000,
    rating: 9.3,

    releaseYear: 2003,
    updatedAt: '2026-07-28T09:00:00.000Z',
  },
];
