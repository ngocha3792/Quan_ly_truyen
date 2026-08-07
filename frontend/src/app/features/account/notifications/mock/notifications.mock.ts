
import { NotificationsView } from '../domain/notifications.models';

export const NOTIFICATIONS_MOCK: NotificationsView = {
    statistics: {
        total: 128,
        unread: 12,
        saved: 8,
        receivedToday: 5,
    },

    settings: {
        newChapters: true,
        comments: true,
        system: true,
        promotions: true,
    },

    notifications: [
        {
            id: 'notification-1',
            type: 'chapter',
            category: 'story',
            title: 'Chương mới: Đấu Phá Thương Khung',
            message:
                'Chương 257: Dị hỏa thức tỉnh vừa được cập nhật.',
            createdAt: '5 phút trước',
            createdAtMinutes: 5,
            tag: 'Cập nhật truyện',
            route: [
                '/truyen',
                'dau-pha-thuong-khung',
                'chuong',
                257,
            ],
            isRead: false,
            isSaved: false,
        },
        {
            id: 'notification-2',
            type: 'comment',
            category: 'account',
            title: 'Bạn có phản hồi mới',
            message:
                'Bình luận của bạn trong Tiên Nghịch đã có 3 lượt trả lời.',
            createdAt: '22 phút trước',
            createdAtMinutes: 22,
            tag: 'Tài khoản',
            route: [
                '/truyen',
                'tien-nghich',
                'chuong',
                128,
            ],
            isRead: false,
            isSaved: true,
        },
        {
            id: 'notification-3',
            type: 'author',
            category: 'system',
            title: 'Theo dõi tác giả',
            message:
                'Nhĩ Căn vừa đăng một thông báo mới cho người theo dõi.',
            createdAt: '1 giờ trước',
            createdAtMinutes: 60,
            tag: 'Hệ thống',
            route: [
                '/tac-gia',
                'nhi-can',
            ],
            isRead: false,
            isSaved: false,
        },
        {
            id: 'notification-4',
            type: 'promotion',
            category: 'promotion',
            title: 'Ưu đãi thành viên',
            message:
                'Gói Premium tháng này đang giảm 20% cho người dùng mới.',
            createdAt: 'Hôm nay',
            createdAtMinutes: 420,
            tag: 'Ưu đãi',
            route: [
                '/tai-khoan',
                'nang-cap',
            ],
            isRead: false,
            isSaved: false,
        },
        {
            id: 'notification-5',
            type: 'security',
            category: 'system',
            title: 'Bảo mật tài khoản',
            message:
                'Tài khoản của bạn vừa đăng nhập trên một thiết bị mới.',
            createdAt: 'Hôm qua',
            createdAtMinutes: 1_540,
            tag: 'Hệ thống',
            route: [
                '/tai-khoan',
                'thiet-bi-dang-nhap',
            ],
            isRead: true,
            isSaved: true,
        },
        {
            id: 'notification-6',
            type: 'following',
            category: 'story',
            title: 'Danh sách truyện theo dõi',
            message:
                'Solo Leveling có 2 chương mới bạn chưa đọc.',
            createdAt: '2 ngày trước',
            createdAtMinutes: 2_880,
            tag: 'Cập nhật truyện',
            route: [
                '/truyen',
                'solo-leveling',
            ],
            isRead: true,
            isSaved: false,
        },
        {
            id: 'notification-7',
            type: 'community',
            category: 'system',
            title: 'Sự kiện cộng đồng',
            message:
                'Tham gia bình chọn truyện nổi bật tuần này.',
            createdAt: '3 ngày trước',
            createdAtMinutes: 4_320,
            tag: 'Hệ thống',
            route: [
                '/su-kien',
            ],
            isRead: true,
            isSaved: false,
        },
        {
            id: 'notification-8',
            type: 'achievement',
            category: 'account',
            title: 'Hoàn thành thành tích',
            message:
                'Chúc mừng! Bạn đã đạt thành tích “Độc giả trung thành”.',
            createdAt: '5 ngày trước',
            createdAtMinutes: 7_200,
            tag: 'Tài khoản',
            route: [
                '/tai-khoan',
                'thanh-tich',
            ],
            isRead: true,
            isSaved: true,
        },
        {
            id: 'notification-9',
            type: 'chapter',
            category: 'story',
            title: 'Chương mới: Ngã Dục Phong Thiên',
            message:
                'Chương 1633 vừa được phát hành.',
            createdAt: '6 ngày trước',
            createdAtMinutes: 8_640,
            tag: 'Cập nhật truyện',
            route: [
                '/truyen',
                'nga-duc-phong-thien',
                'chuong',
                1633,
            ],
            isRead: true,
            isSaved: false,
        },
        {
            id: 'notification-10',
            type: 'comment',
            category: 'account',
            title: 'Bình luận được yêu thích',
            message:
                'Bình luận của bạn đã nhận được 50 lượt thích.',
            createdAt: '1 tuần trước',
            createdAtMinutes: 10_080,
            tag: 'Tài khoản',
            route: [
                '/tai-khoan',
                'binh-luan',
            ],
            isRead: true,
            isSaved: false,
        },
        {
            id: 'notification-11',
            type: 'security',
            category: 'system',
            title: 'Cập nhật chính sách bảo mật',
            message:
                'Chính sách bảo mật của TruyenHub vừa được cập nhật.',
            createdAt: '2 tuần trước',
            createdAtMinutes: 20_160,
            tag: 'Hệ thống',
            route: [
                '/quyen-rieng-tu',
            ],
            isRead: true,
            isSaved: true,
        },
        {
            id: 'notification-12',
            type: 'promotion',
            category: 'promotion',
            title: 'Sự kiện đọc truyện tháng mới',
            message:
                'Đọc đủ 20 chương để nhận huy hiệu giới hạn.',
            createdAt: '3 tuần trước',
            createdAtMinutes: 30_240,
            tag: 'Ưu đãi',
            route: [
                '/su-kien',
            ],
            isRead: true,
            isSaved: false,
        },
    ],

    recentActivities: [
        {
            id: 'activity-1',
            time: '5 phút trước',
            description:
                'Đấu Phá Thương Khung có chương mới',
        },
        {
            id: 'activity-2',
            time: '22 phút trước',
            description:
                'Bạn nhận được phản hồi mới trong Tiên Nghịch',
        },
        {
            id: 'activity-3',
            time: '1 giờ trước',
            description:
                'Nhĩ Căn đăng thông báo mới cho người theo dõi',
        },
    ],
};