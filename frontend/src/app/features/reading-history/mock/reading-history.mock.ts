
import { ReadingHistoryView } from '../domain/reading-history.models';

export const READING_HISTORY_MOCK: ReadingHistoryView = {
    statistics: {
        storiesRead: '12',
        chaptersRead: '3.254',
        weeklyReadingTime: '8 giờ 45 phút',
        followedStories: '18',
    },

    history: [
        {
            id: 'history-dau-pha-thuong-khung',
            storySlug: 'dau-pha-thuong-khung',
            title: 'Đấu Phá Thương Khung',
            author: 'Thiên Tằm Thổ Đậu',
            genres: [
                'Tiên hiệp',
                'Huyền huyễn',
                'Tu chân',
            ],

            chapterNumber: 256,
            chapterTitle: 'Vẫn lạc tâm viêm',

            progress: 85,
            lastReadLabel: '2 giờ trước',
            lastReadMinutes: 120,

            coverInitials: 'ĐP',
            coverTone: 'blue',
        },
        {
            id: 'history-solo-leveling',
            storySlug: 'solo-leveling',
            title: 'Solo Leveling',
            author: 'Chugong',
            genres: [
                'Hành động',
                'Kỳ ảo',
                'Hiện đại',
            ],

            chapterNumber: 182,
            chapterTitle: 'Trận chiến cuối cùng',

            progress: 72,
            lastReadLabel: '5 giờ trước',
            lastReadMinutes: 300,

            coverInitials: 'SL',
            coverTone: 'orange',
        },
        {
            id: 'history-tu-luc-bat-dau-lien-vo-dich',
            storySlug: 'tu-luc-bat-dau-lien-vo-dich',
            title: 'Từ Lúc Bắt Đầu Liền Vô Địch',
            author: 'Thiên Tằm Thổ Đậu',
            genres: [
                'Huyền huyễn',
                'Hệ thống',
                'Xuyên không',
            ],

            chapterNumber: 412,
            chapterTitle: 'Thiên địa biến đổi',

            progress: 93,
            lastReadLabel: '1 ngày trước',
            lastReadMinutes: 1_440,

            coverInitials: 'TV',
            coverTone: 'silver',
        },
        {
            id: 'history-toan-chuc-phap-su',
            storySlug: 'toan-chuc-phap-su',
            title: 'Toàn Chức Pháp Sư',
            author: 'Loạn',
            genres: [
                'Huyền huyễn',
                'Hiện đại',
                'Ma pháp',
            ],

            chapterNumber: 1186,
            chapterTitle: 'Không gian phong bạo',

            progress: 68,
            lastReadLabel: '1 ngày trước',
            lastReadMinutes: 1_680,

            coverInitials: 'TP',
            coverTone: 'violet',
        },
        {
            id: 'history-than-an-vuong-toa',
            storySlug: 'than-an-vuong-toa',
            title: 'Thần Ấn Vương Tọa',
            author: 'Đường Gia Tam Thiếu',
            genres: [
                'Huyền huyễn',
                'Long huyễn',
                'Chiến đấu',
            ],

            chapterNumber: 324,
            chapterTitle: 'Thần ấn thức tỉnh',

            progress: 57,
            lastReadLabel: '2 ngày trước',
            lastReadMinutes: 2_880,

            coverInitials: 'TA',
            coverTone: 'gold',
        },
        {
            id: 'history-vo-than-chua-te',
            storySlug: 'vo-than-chua-te',
            title: 'Võ Thần Chúa Tể',
            author: 'Ám Ma Sư',
            genres: [
                'Tiên hiệp',
                'Huyền huyễn',
                'Tu chân',
            ],

            chapterNumber: 894,
            chapterTitle: 'Thánh địa bí cảnh',

            progress: 41,
            lastReadLabel: '3 ngày trước',
            lastReadMinutes: 4_320,

            coverInitials: 'VT',
            coverTone: 'cyan',
        },
        {
            id: 'history-tien-nghich',
            storySlug: 'tien-nghich',
            title: 'Tiên Nghịch',
            author: 'Nhĩ Căn',
            genres: [
                'Tiên hiệp',
                'Tu chân',
            ],

            chapterNumber: 128,
            chapterTitle: 'Vấn đạo nơi tinh không',

            progress: 36,
            lastReadLabel: '8 ngày trước',
            lastReadMinutes: 11_520,

            coverInitials: 'TN',
            coverTone: 'violet',
        },
        {
            id: 'history-nga-duc-phong-thien',
            storySlug: 'nga-duc-phong-thien',
            title: 'Ngã Dục Phong Thiên',
            author: 'Nhĩ Căn',
            genres: [
                'Tiên hiệp',
                'Huyền huyễn',
            ],

            chapterNumber: 678,
            chapterTitle: 'Phong thiên chi lộ',

            progress: 24,
            lastReadLabel: '18 ngày trước',
            lastReadMinutes: 25_920,

            coverInitials: 'NP',
            coverTone: 'blue',
        },
    ],

    continueReading: [
        {
            id: 'continue-dau-pha-thuong-khung',
            storySlug: 'dau-pha-thuong-khung',
            title: 'Đấu Phá Thương Khung',
            chapterNumber: 256,
            progress: 85,
            coverInitials: 'ĐP',
            coverTone: 'blue',
        },
        {
            id: 'continue-tu-luc-bat-dau-lien-vo-dich',
            storySlug: 'tu-luc-bat-dau-lien-vo-dich',
            title: 'Từ Lúc Bắt Đầu Liền Vô Địch',
            chapterNumber: 412,
            progress: 93,
            coverInitials: 'TV',
            coverTone: 'silver',
        },
        {
            id: 'continue-toan-chuc-phap-su',
            storySlug: 'toan-chuc-phap-su',
            title: 'Toàn Chức Pháp Sư',
            chapterNumber: 1186,
            progress: 68,
            coverInitials: 'TP',
            coverTone: 'violet',
        },
    ],
};