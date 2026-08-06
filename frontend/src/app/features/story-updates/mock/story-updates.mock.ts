import {
    StoryUpdateGenreSummary,
    StoryUpdateItem,
    StoryUpdateScheduleItem,
    StoryUpdateStat,
} from '../domain/story-updates.models';

export const STORY_UPDATE_ITEMS_MOCK:
    readonly StoryUpdateItem[] = [
        {
            id: 'story-solo-leveling',
            slug: 'solo-leveling',

            title: 'Solo Leveling',

            description:
                'Sung Jinwoo, người được mệnh danh là thợ săn yếu nhất thế giới, bỗng nhiên nhận được khả năng tăng cấp kỳ lạ.',

            coverUrl:
                '/assets/mock/stories/solo-leveling.webp',

            bannerUrl:
                '/assets/mock/stories/solo-leveling.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Hành động',
                },
                {
                    slug: 'phieu-luu',
                    name: 'Phiêu lưu',
                },
                {
                    slug: 'fantasy',
                    name: 'Fantasy',
                },
            ],

            latestChapter: 188,
            previousChapter: 187,

            updatedAt:
                '2026-08-05T22:21:00+07:00',

            viewCount: 2_300_000,
            commentCount: 12_500,

            status: 'ongoing',
            badge: 'featured',

            followed: true,
            hot: true,
        },
        {
            id: 'story-girl',
            slug:
                'toi-nhat-duoc-mot-co-gai',

            title:
                'Tôi Nhặt Được Một Cô Gái',

            description:
                'Một cuộc gặp gỡ bất ngờ làm thay đổi cuộc sống của một thanh niên bình thường.',

            coverUrl:
                '/assets/mock/stories/toi-nhat-duoc-mot-co-gai.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'romance',
                    name: 'Romance',
                },
                {
                    slug: 'hoc-duong',
                    name: 'Học đường',
                },
            ],

            latestChapter: 125,
            previousChapter: 124,

            updatedAt:
                '2026-08-05T22:21:00+07:00',

            viewCount: 98_700,
            commentCount: 1_200,

            status: 'ongoing',
            badge: 'new',

            followed: false,
            hot: false,
        },
        {
            id: 'story-demon-slayer',
            slug: 'thanh-guom-diet-quy',

            title:
                'Thanh Gươm Diệt Quỷ',

            description:
                'Hành trình chiến đấu chống lại quỷ dữ của kiếm sĩ trẻ Tanjiro.',

            coverUrl:
                '/assets/mock/stories/thanh-guom-diet-quy.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Hành động',
                },
                {
                    slug: 'fantasy',
                    name: 'Fantasy',
                },
            ],

            latestChapter: 205,
            previousChapter: 204,

            updatedAt:
                '2026-08-05T22:11:00+07:00',

            viewCount: 126_400,
            commentCount: 2_100,

            status: 'completed',
            badge: 'hot',

            followed: true,
            hot: true,
        },
        {
            id: 'story-immortal-king',
            slug:
                'van-gioi-tien-vuong',

            title:
                'Vạn Giới Tiên Vương',

            description:
                'Một cường giả bước qua vạn giới để tìm lại sức mạnh đã mất.',

            coverUrl:
                '/assets/mock/stories/van-gioi-tien-vuong.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'tien-hiep',
                    name: 'Tiên hiệp',
                },
                {
                    slug: 'huyen-huyen',
                    name: 'Huyền huyễn',
                },
            ],

            latestChapter: 976,
            previousChapter: 975,

            updatedAt:
                '2026-08-05T22:06:00+07:00',

            viewCount: 85_200,
            commentCount: 1_100,

            status: 'ongoing',
            badge: null,

            followed: false,
            hot: true,
        },
        {
            id: 'story-kengan',
            slug: 'kengan-omega',

            title: 'Kengan Omega',

            description:
                'Những trận đấu võ thuật khốc liệt trong đấu trường Kengan.',

            coverUrl:
                '/assets/mock/stories/kengan-omega.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'vo-thuat',
                    name: 'Võ thuật',
                },
                {
                    slug: 'dau-truong',
                    name: 'Đấu trường',
                },
            ],

            latestChapter: 274,
            previousChapter: 273,

            updatedAt:
                '2026-08-05T21:56:00+07:00',

            viewCount: 64_100,
            commentCount: 892,

            status: 'ongoing',
            badge: null,

            followed: false,
            hot: false,
        },
        {
            id: 'story-return-strongest',
            slug:
                'tro-lai-lam-manh-nhat',

            title:
                'Trở Lại Làm Mạnh Nhất',

            description:
                'Sau khi trở về quá khứ, hắn quyết tâm sửa chữa tất cả sai lầm.',

            coverUrl:
                '/assets/mock/stories/tro-lai-lam-manh-nhat.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Hành động',
                },
                {
                    slug: 'isekai',
                    name: 'Isekai',
                },
            ],

            latestChapter: 86,
            previousChapter: 85,

            updatedAt:
                '2026-08-05T21:41:00+07:00',

            viewCount: 77_300,
            commentCount: 970,

            status: 'ongoing',
            badge: 'new',

            followed: true,
            hot: true,
        },
        {
            id: 'story-rebirth-system',
            slug:
                'tan-the-trung-sinh-ta-co-he-thong',

            title:
                'Tận Thế Trùng Sinh: Ta Có Hệ Thống',

            description:
                'Trở lại ngày tận thế bắt đầu với một hệ thống bí ẩn.',

            coverUrl:
                '/assets/mock/stories/tan-the-trung-sinh.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'kinh-di',
                    name: 'Kinh dị',
                },
                {
                    slug: 'sinh-ton',
                    name: 'Sinh tồn',
                },
            ],

            latestChapter: 112,
            previousChapter: 111,

            updatedAt:
                '2026-08-05T21:26:00+07:00',

            viewCount: 53_800,
            commentCount: 745,

            status: 'ongoing',
            badge: null,

            followed: false,
            hot: false,
        },
        {
            id: 'story-yinian-yongheng',
            slug: 'nhat-niem-vinh-hang',

            title:
                'Nhất Niệm Vĩnh Hằng',

            description:
                'Con đường tu tiên đầy hài hước và những thử thách bất ngờ.',

            coverUrl:
                '/assets/mock/stories/nhat-niem-vinh-hang.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'tien-hiep',
                    name: 'Tiên hiệp',
                },
                {
                    slug: 'huyen-huyen',
                    name: 'Huyền huyễn',
                },
            ],

            latestChapter: 1483,
            previousChapter: 1482,

            updatedAt:
                '2026-08-05T21:26:00+07:00',

            viewCount: 49_600,
            commentCount: 621,

            status: 'ongoing',
            badge: null,

            followed: false,
            hot: false,
        },
        {
            id: 'story-wind-breaker',
            slug: 'wind-breaker',

            title: 'Wind Breaker',

            description:
                'Những cuộc đua xe đạp đường phố và tình bạn tuổi trẻ.',

            coverUrl:
                '/assets/mock/stories/wind-breaker.webp',

            bannerUrl: null,

            genres: [
                {
                    slug: 'hoc-duong',
                    name: 'Học đường',
                },
                {
                    slug: 'vo-thuat',
                    name: 'Võ thuật',
                },
            ],

            latestChapter: 156,
            previousChapter: 155,

            updatedAt:
                '2026-08-05T20:26:00+07:00',

            viewCount: 42_200,
            commentCount: 563,

            status: 'ongoing',
            badge: null,

            followed: true,
            hot: false,
        },
    ];

export const STORY_UPDATE_STATS_MOCK:
    readonly StoryUpdateStat[] = [
        {
            id: 'updated-stories',

            label:
                'Truyện vừa cập nhật',

            value: 1_248,
            valueSuffix: null,

            comparisonText:
                '+36 hôm nay',

            tone: 'purple',
        },
        {
            id: 'chapters-today',

            label:
                'Chương mới hôm nay',

            value: 3_256,
            valueSuffix: null,

            comparisonText:
                '+128 hôm nay',

            tone: 'blue',
        },
        {
            id: 'following',

            label: 'Đang theo dõi',

            value: 56,
            valueSuffix: null,

            comparisonText:
                '↑ 3 tuần này',

            tone: 'pink',
        },
        {
            id: 'average-speed',

            label: 'Cập nhật nhanh',

            value: 5,
            valueSuffix: 'phút',

            comparisonText:
                'Trung bình',

            tone: 'orange',
        },
    ];

export const STORY_UPDATE_SCHEDULE_MOCK:
    readonly StoryUpdateScheduleItem[] = [
        {
            id: 'today',
            label: 'Hôm nay',
            chapterCount: 3_256,
        },
        {
            id: 'tomorrow',
            label: 'Ngày mai',
            chapterCount: 2_104,
        },
        {
            id: 'next-two-days',
            label: '2 ngày tới',
            chapterCount: 1_678,
        },
    ];

export const STORY_UPDATE_GENRES_MOCK:
    readonly StoryUpdateGenreSummary[] = [
        {
            slug: 'hanh-dong',
            name: 'Hành động',
        },
        {
            slug: 'fantasy',
            name: 'Fantasy',
        },
        {
            slug: 'tien-hiep',
            name: 'Tiên hiệp',
        },
        {
            slug: 'romance',
            name: 'Romance',
        },
        {
            slug: 'hoc-duong',
            name: 'Học đường',
        },
        {
            slug: 'kinh-di',
            name: 'Kinh dị',
        },
        {
            slug: 'isekai',
            name: 'Isekai',
        },
        {
            slug: 'vo-thuat',
            name: 'Võ thuật',
        },
    ];