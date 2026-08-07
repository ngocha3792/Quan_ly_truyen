import { AuthorStudioDashboard, ReadershipChartPoint } from '../domain/author-studio.models';

const createChartPoints = (
  prefix: string,
  values: readonly number[],
): readonly ReadershipChartPoint[] =>
  values.map((value, index) => ({
    id: `${prefix}-${index}`,
    label: `${index + 1}/05`,
    value,
  }));

export const AUTHOR_STUDIO_MOCK: AuthorStudioDashboard = {
  profile: {
    displayName: 'Lục Dạ Phong',
    penName: 'Tác giả',
    avatarUrl:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop',
    level: 8,
    currentExperience: 2450,
    requiredExperience: 3000,
    verified: true,
  },

  unreadNotifications: 3,

  metrics: [
    {
      id: 'published-stories',
      title: 'Truyện đang xuất bản',
      value: '6',
      trendValue: '20%',
      trendLabel: 'so với tháng trước',
      trendDirection: 'up',
      icon: 'book',
      tone: 'purple',
    },
    {
      id: 'drafts',
      title: 'Bản nháp',
      value: '12',
      trendValue: '9%',
      trendLabel: 'so với tháng trước',
      trendDirection: 'up',
      icon: 'draft',
      tone: 'blue',
    },
    {
      id: 'pending-chapters',
      title: 'Chương chờ duyệt',
      value: '5',
      trendValue: '16%',
      trendLabel: 'so với tuần trước',
      trendDirection: 'down',
      icon: 'clock',
      tone: 'orange',
    },
    {
      id: 'views',
      title: 'Lượt xem 30 ngày',
      value: '128.6K',
      trendValue: '28.5%',
      trendLabel: 'so với 30 ngày trước',
      trendDirection: 'up',
      icon: 'eye',
      tone: 'indigo',
    },
    {
      id: 'followers',
      title: 'Người theo dõi',
      value: '23.4K',
      trendValue: '18.3%',
      trendLabel: 'so với tháng trước',
      trendDirection: 'up',
      icon: 'users',
      tone: 'pink',
    },
    {
      id: 'revenue',
      title: 'Doanh thu tháng',
      value: '18.750.000 ₫',
      trendValue: '32.1%',
      trendLabel: 'so với tháng trước',
      trendDirection: 'up',
      icon: 'wallet',
      tone: 'green',
    },
  ],

  readership: {
    '7d': createChartPoints('7d', [9200, 11500, 10800, 14260, 12200, 13400, 9800]),

    '30d': createChartPoints(
      '30d',
      [
        5200, 8400, 9200, 8800, 11800, 9000, 12100, 13200, 13800, 9200, 10100, 9500, 7800, 6200,
        11000, 11600, 14800, 15800, 17000, 17500, 12300, 10800, 9200, 7600, 9400, 9800, 14260,
        11800, 8600, 7200,
      ],
    ),

    '90d': createChartPoints(
      '90d',
      [
        4800, 5200, 6100, 5800, 7200, 8100, 7600, 9400, 8800, 10200, 9800, 11500, 10800, 12400,
        11800, 13200, 12100, 14400, 13800, 15200, 14800, 16200, 15600, 17000, 16400, 17800, 17200,
        18500, 17600, 19200,
      ],
    ),
  },

  schedule: [
    {
      id: 'schedule-1',
      weekday: 'T2',
      date: '26/05',
      storyTitle: 'Đại Đạo Chí Tôn',
      chapterTitle: 'Chương 326: Quyết Chiến Thiên Ma',
      time: '20:00',
      status: 'scheduled',
      statusLabel: 'Đã lên lịch',
      coverUrl:
        'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=120&auto=format&fit=crop',
    },
    {
      id: 'schedule-2',
      weekday: 'T4',
      date: '28/05',
      storyTitle: 'Vạn Cổ Thần Đế',
      chapterTitle: 'Chương 584: Truyền Thừa Cổ Thần',
      time: '20:00',
      status: 'published',
      statusLabel: 'Đã lên lịch',
      coverUrl:
        'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=120&auto=format&fit=crop',
    },
    {
      id: 'schedule-3',
      weekday: 'T6',
      date: '30/05',
      storyTitle: 'Kiếm Vực Độc Tôn',
      chapterTitle: 'Chương 157: Kiếm Ý Thức Tỉnh',
      time: '20:00',
      status: 'pending',
      statusLabel: 'Chờ duyệt',
      coverUrl:
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=120&auto=format&fit=crop',
    },
    {
      id: 'schedule-4',
      weekday: 'CN',
      date: '01/06',
      storyTitle: 'Thần Cấp Phản Phái Hệ Thống',
      chapterTitle: 'Chương 221: Phản Công',
      time: '20:00',
      status: 'draft',
      statusLabel: 'Bản nháp',
      coverUrl:
        'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=120&auto=format&fit=crop',
    },
  ],

  stories: [
    {
      id: 'story-1',
      slug: 'dai-dao-chi-ton',
      title: 'Đại Đạo Chí Tôn',
      coverUrl:
        'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=100&auto=format&fit=crop',
      genres: ['Tiên Hiệp', 'Huyền Huyễn'],
      status: 'publishing',
      statusLabel: 'Đang cập nhật',
      latestChapter: 325,
      updatedAt: '23/05/2026',
    },
    {
      id: 'story-2',
      slug: 'van-co-than-de',
      title: 'Vạn Cổ Thần Đế',
      coverUrl:
        'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=100&auto=format&fit=crop',
      genres: ['Tiên Hiệp', 'Huyền Huyễn'],
      status: 'publishing',
      statusLabel: 'Đang cập nhật',
      latestChapter: 583,
      updatedAt: '22/05/2026',
    },
    {
      id: 'story-3',
      slug: 'kiem-vuc-doc-ton',
      title: 'Kiếm Vực Độc Tôn',
      coverUrl:
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop',
      genres: ['Huyền Huyễn', 'Kiếm Hiệp'],
      status: 'publishing',
      statusLabel: 'Đang cập nhật',
      latestChapter: 156,
      updatedAt: '21/05/2026',
    },
    {
      id: 'story-4',
      slug: 'than-cap-phan-phai-he-thong',
      title: 'Thần Cấp Phản Phái Hệ Thống',
      coverUrl:
        'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=100&auto=format&fit=crop',
      genres: ['Đô Thị', 'Hệ Thống'],
      status: 'publishing',
      statusLabel: 'Đang cập nhật',
      latestChapter: 220,
      updatedAt: '20/05/2026',
    },
    {
      id: 'story-5',
      slug: 'ta-co-mot-toa-luyen-dan-lau',
      title: 'Ta Có Một Tòa Luyện Đan Lâu',
      coverUrl:
        'https://images.unsplash.com/photo-1518709779341-56cf4535e94b?w=100&auto=format&fit=crop',
      genres: ['Tiên Hiệp', 'Luyện Đan'],
      status: 'paused',
      statusLabel: 'Tạm dừng',
      latestChapter: 112,
      updatedAt: '19/05/2026',
    },
  ],

  drafts: [
    {
      id: 'draft-1',
      storyTitle: 'Đại Đạo Chí Tôn',
      chapterTitle: 'Chương 327: Bí Cảnh Mở Ra',
      updatedAt: '23/05/2026 14:30',
      completionPercent: 78,
    },
    {
      id: 'draft-2',
      storyTitle: 'Vạn Cổ Thần Đế',
      chapterTitle: 'Chương 585: Bí Mật Thần Vực',
      updatedAt: '22/05/2026 09:12',
      completionPercent: 45,
    },
    {
      id: 'draft-3',
      storyTitle: 'Ta Có Một Tòa Luyện Đan Lâu',
      chapterTitle: 'Chương 113: Đan Phương Mới',
      updatedAt: '21/05/2026 18:45',
      completionPercent: 20,
    },
    {
      id: 'draft-4',
      storyTitle: 'Kiếm Vực Độc Tôn',
      chapterTitle: 'Chương 158: Tông Môn Đại Hội',
      updatedAt: '20/05/2026 11:05',
      completionPercent: 10,
    },
  ],

  comments: [
    {
      id: 'comment-1',
      readerName: 'Thiên Vũ',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop',
      storyTitle: 'Đại Đạo Chí Tôn',
      content: 'Truyện càng ngày càng hay, mong tác giả ra chương đều nhé! 💪',
      createdAt: '30 phút trước',
      unread: true,
    },
    {
      id: 'comment-2',
      readerName: 'Huyền Lạc',
      avatarUrl:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop',
      storyTitle: 'Vạn Cổ Thần Đế',
      content: 'Chương này quá đỉnh! Có thể giải thích thêm về bí cảnh không?',
      createdAt: '1 giờ trước',
      unread: true,
    },
    {
      id: 'comment-3',
      readerName: 'Minh Tâm',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
      storyTitle: 'Kiếm Vực Độc Tôn',
      content: 'Kiếm ý của nhân vật chính thật sự quá ngầu!',
      createdAt: '3 giờ trước',
      unread: true,
    },
  ],

  topStories: [
    {
      id: 'top-story-1',
      rank: 1,
      title: 'Đại Đạo Chí Tôn',
      coverUrl:
        'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=100&auto=format&fit=crop',
      views: '68.2K',
    },
    {
      id: 'top-story-2',
      rank: 2,
      title: 'Vạn Cổ Thần Đế',
      coverUrl:
        'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=100&auto=format&fit=crop',
      views: '42.7K',
    },
    {
      id: 'top-story-3',
      rank: 3,
      title: 'Kiếm Vực Độc Tôn',
      coverUrl:
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop',
      views: '24.1K',
    },
  ],

  monthlyGoals: [
    {
      id: 'goal-chapters',
      label: 'Số chương viết',
      currentValue: '28',
      targetValue: '40',
      progress: 70,
      icon: 'book',
      tone: 'purple',
    },
    {
      id: 'goal-views',
      label: 'Lượt xem',
      currentValue: '128.6K',
      targetValue: '150K',
      progress: 86,
      icon: 'eye',
      tone: 'indigo',
    },
    {
      id: 'goal-revenue',
      label: 'Doanh thu',
      currentValue: '18.75M',
      targetValue: '25M',
      progress: 75,
      icon: 'wallet',
      tone: 'green',
    },
  ],
};
