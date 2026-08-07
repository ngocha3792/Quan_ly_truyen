
import { MyLibraryView } from '../domain/my-library.models';

export const MY_LIBRARY_MOCK: MyLibraryView = {
    stories: [
        {
            id: 'library-toan-chuc-phap-su',
            slug: 'toan-chuc-phap-su',
            title: 'Toàn Chức Pháp Sư',
            author: 'Loạn',
            genres: [
                'Huyền huyễn',
                'Hệ thống',
                'Học đường',
            ],

            currentChapter: 256,
            latestChapter: 376,
            progress: 68,

            lastReadLabel: '2 giờ trước',
            lastReadMinutes: 120,

            isReading: true,
            isFollowing: true,
            isFavorite: false,
            isCompleted: false,

            coverInitials: 'TP',
            coverTone: 'blue',
        },
        {
            id: 'library-than-an-vuong-toa',
            slug: 'than-an-vuong-toa',
            title: 'Thần Ấn Vương Tọa',
            author: 'Đường Gia Tam Thiếu',
            genres: [
                'Huyền huyễn',
                'Chiến đấu',
                'Ma pháp',
            ],

            currentChapter: 412,
            latestChapter: 448,
            progress: 92,

            lastReadLabel: 'Hôm qua',
            lastReadMinutes: 1_440,

            isReading: true,
            isFollowing: true,
            isFavorite: true,
            isCompleted: false,

            coverInitials: 'TA',
            coverTone: 'violet',
        },
        {
            id: 'library-dau-pha-thuong-khung',
            slug: 'dau-pha-thuong-khung',
            title: 'Đấu Phá Thương Khung',
            author: 'Thiên Tằm Thổ Đậu',
            genres: [
                'Tiên hiệp',
                'Võ hiệp',
                'Tu chân',
            ],

            currentChapter: 1876,
            latestChapter: 2500,
            progress: 75,

            lastReadLabel: '5 giờ trước',
            lastReadMinutes: 300,

            isReading: true,
            isFollowing: true,
            isFavorite: false,
            isCompleted: false,

            coverInitials: 'ĐP',
            coverTone: 'violet',
        },
        {
            id: 'library-bach-luyen-thanh-than',
            slug: 'bach-luyen-thanh-than',
            title: 'Bách Luyện Thành Thần',
            author: 'Ân Tứ Giải Thoát',
            genres: [
                'Huyền huyễn',
                'Chiến đấu',
                'Thăng cấp',
            ],

            currentChapter: 3205,
            latestChapter: 3205,
            progress: 100,

            lastReadLabel: '1 tuần trước',
            lastReadMinutes: 10_080,

            isReading: false,
            isFollowing: true,
            isFavorite: false,
            isCompleted: true,

            coverInitials: 'BL',
            coverTone: 'orange',
        },
        {
            id: 'library-van-co-than-de',
            slug: 'van-co-than-de',
            title: 'Vạn Cổ Thần Đế',
            author: 'Phi Thiên Ngư',
            genres: [
                'Tiên hiệp',
                'Thăng cấp',
                'Bá đạo',
            ],

            currentChapter: 1034,
            latestChapter: 2330,
            progress: 45,

            lastReadLabel: '1 ngày trước',
            lastReadMinutes: 1_760,

            isReading: true,
            isFollowing: true,
            isFavorite: false,
            isCompleted: false,

            coverInitials: 'VC',
            coverTone: 'silver',
        },
        {
            id: 'library-toi-cuong-phan-sao-lo',
            slug: 'toi-cuong-phan-sao-lo',
            title: 'Tối Cường Phản Sáo Lộ',
            author: 'Thập Lý Kiếm Thần',
            genres: [
                'Đô thị',
                'Hệ thống',
                'Hài hước',
            ],

            currentChapter: 634,
            latestChapter: 1980,
            progress: 32,

            lastReadLabel: '2 ngày trước',
            lastReadMinutes: 2_880,

            isReading: false,
            isFollowing: true,
            isFavorite: false,
            isCompleted: false,

            coverInitials: 'TC',
            coverTone: 'cyan',
        },
        {
            id: 'library-nghich-thien-ta-than',
            slug: 'nghich-thien-ta-than',
            title: 'Nghịch Thiên Tà Thần',
            author: 'Nhĩ Căn',
            genres: [
                'Tiên hiệp',
                'Huyền huyễn',
                'Tu chân',
            ],

            currentChapter: 945,
            latestChapter: 1166,
            progress: 81,

            lastReadLabel: '3 ngày trước',
            lastReadMinutes: 4_320,

            isReading: true,
            isFollowing: true,
            isFavorite: true,
            isCompleted: false,

            coverInitials: 'NT',
            coverTone: 'crimson',
        },
        {
            id: 'library-ta-co-mot-son-trai',
            slug: 'ta-co-mot-son-trai',
            title: 'Ta Có Một Sơn Trại',
            author: 'Thổ Lý Thất Không Cối',
            genres: [
                'Điền văn',
                'Hệ thống',
                'Xuyên không',
            ],

            currentChapter: 1256,
            latestChapter: 1256,
            progress: 100,

            lastReadLabel: '2 tuần trước',
            lastReadMinutes: 20_160,

            isReading: false,
            isFollowing: false,
            isFavorite: false,
            isCompleted: true,

            coverInitials: 'ST',
            coverTone: 'indigo',
        },
        {
            id: 'library-tien-nghich',
            slug: 'tien-nghich',
            title: 'Tiên Nghịch',
            author: 'Nhĩ Căn',
            genres: [
                'Tiên hiệp',
                'Tu chân',
            ],

            currentChapter: 988,
            latestChapter: 2088,
            progress: 47,

            lastReadLabel: '4 ngày trước',
            lastReadMinutes: 5_760,

            isReading: true,
            isFollowing: true,
            isFavorite: true,
            isCompleted: false,

            coverInitials: 'TN',
            coverTone: 'gold',
        },
        {
            id: 'library-nga-duc-phong-thien',
            slug: 'nga-duc-phong-thien',
            title: 'Ngã Dục Phong Thiên',
            author: 'Nhĩ Căn',
            genres: [
                'Tiên hiệp',
                'Huyền huyễn',
            ],

            currentChapter: 420,
            latestChapter: 1632,
            progress: 26,

            lastReadLabel: '6 ngày trước',
            lastReadMinutes: 8_640,

            isReading: false,
            isFollowing: true,
            isFavorite: false,
            isCompleted: false,

            coverInitials: 'NP',
            coverTone: 'blue',
        },
        {
            id: 'library-than-dao-dan-ton',
            slug: 'than-dao-dan-ton',
            title: 'Thần Đạo Đan Tôn',
            author: 'Cô Đơn Địa Phi',
            genres: [
                'Huyền huyễn',
                'Đan dược',
            ],

            currentChapter: 1850,
            latestChapter: 1850,
            progress: 100,

            lastReadLabel: '1 tháng trước',
            lastReadMinutes: 43_200,

            isReading: false,
            isFollowing: false,
            isFavorite: false,
            isCompleted: true,

            coverInitials: 'ĐT',
            coverTone: 'gold',
        },
        {
            id: 'library-dai-chua-te',
            slug: 'dai-chua-te',
            title: 'Đại Chúa Tể',
            author: 'Thiên Tằm Thổ Đậu',
            genres: [
                'Huyền huyễn',
                'Thăng cấp',
            ],

            currentChapter: 722,
            latestChapter: 1551,
            progress: 46,

            lastReadLabel: '10 ngày trước',
            lastReadMinutes: 14_400,

            isReading: false,
            isFollowing: true,
            isFavorite: false,
            isCompleted: false,

            coverInitials: 'ĐC',
            coverTone: 'cyan',
        },
    ],

    quickItems: [
        {
            id: 'quick-toan-chuc-phap-su',
            slug: 'toan-chuc-phap-su',
            title: 'Toàn Chức Pháp Sư',
            chapter: 256,
            progress: 68,
            coverInitials: 'TP',
            coverTone: 'blue',
        },
        {
            id: 'quick-than-an-vuong-toa',
            slug: 'than-an-vuong-toa',
            title: 'Thần Ấn Vương Tọa',
            chapter: 412,
            progress: 92,
            coverInitials: 'TA',
            coverTone: 'violet',
        },
        {
            id: 'quick-dau-pha-thuong-khung',
            slug: 'dau-pha-thuong-khung',
            title: 'Đấu Phá Thương Khung',
            chapter: 1876,
            progress: 75,
            coverInitials: 'ĐP',
            coverTone: 'crimson',
        },
        {
            id: 'quick-van-co-than-de',
            slug: 'van-co-than-de',
            title: 'Vạn Cổ Thần Đế',
            chapter: 1034,
            progress: 45,
            coverInitials: 'VC',
            coverTone: 'silver',
        },
    ],

    goal: {
        targetChapters: 20,
        completedChapters: 12,
        remainingDays: 3,
    },
};