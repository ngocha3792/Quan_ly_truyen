
import {
    AuthorApplicationConfig,
    AuthorApplicationResult,
} from '../domain/author-application.models';

export const AUTHOR_APPLICATION_CONFIG_MOCK:
    AuthorApplicationConfig = {
    genreOptions: [
        {
            value: 'tien-hiep',
            label: 'Tiên hiệp',
        },
        {
            value: 'huyen-huyen',
            label: 'Huyền huyễn',
        },
        {
            value: 'do-thi',
            label: 'Đô thị',
        },
        {
            value: 'ngon-tinh',
            label: 'Ngôn tình',
        },
        {
            value: 'kiem-hiep',
            label: 'Kiếm hiệp',
        },
        {
            value: 'khoa-huyen',
            label: 'Khoa huyễn',
        },
        {
            value: 'kinh-di',
            label: 'Kinh dị',
        },
        {
            value: 'lich-su',
            label: 'Lịch sử',
        },
        {
            value: 'khac',
            label: 'Thể loại khác',
        },
    ],

    experienceOptions: [
        {
            value: 'new',
            label: 'Chưa từng sáng tác',
        },
        {
            value: 'under-1-year',
            label: 'Dưới 1 năm',
        },
        {
            value: '1-3-years',
            label: 'Từ 1 đến 3 năm',
        },
        {
            value: '3-5-years',
            label: 'Từ 3 đến 5 năm',
        },
        {
            value: 'over-5-years',
            label: 'Trên 5 năm',
        },
    ],

    requirements: [
        {
            id: 'requirement-information',
            content:
                'Cung cấp đầy đủ và chính xác thông tin cá nhân.',
        },
        {
            id: 'requirement-sample',
            content:
                'Có mẫu nội dung hoặc chương truyện rõ ràng.',
        },
        {
            id: 'requirement-community',
            content:
                'Cam kết tuân thủ quy định nội dung và chính sách cộng đồng.',
        },
    ],

    reviewSteps: [
        {
            number: 1,
            title: 'Gửi yêu cầu',
            description:
                'Hoàn thành biểu mẫu và gửi hồ sơ đăng ký.',
        },
        {
            number: 2,
            title: 'Đội ngũ xét duyệt',
            description:
                'Chúng tôi xem xét hồ sơ trong 3–5 ngày làm việc.',
        },
        {
            number: 3,
            title: 'Kích hoạt hồ sơ tác giả',
            description:
                'Nhận thông báo và bắt đầu đăng tải tác phẩm.',
        },
    ],

    benefits: [
        {
            id: 'benefit-work',
            icon: 'work',
            title: 'Quản lý tác phẩm',
            description:
                'Dễ đăng tải, chỉnh sửa và sắp xếp tác phẩm.',
        },
        {
            id: 'benefit-analytics',
            icon: 'analytics',
            title: 'Thống kê lượt đọc',
            description:
                'Theo dõi số liệu chi tiết và hiệu quả nội dung.',
        },
        {
            id: 'benefit-community',
            icon: 'community',
            title: 'Tương tác với độc giả',
            description:
                'Nhận bình luận, yêu thích và xây dựng cộng đồng.',
        },
    ],

    acceptedFileExtensions: [
        '.doc',
        '.docx',
        '.pdf',
        '.txt',
    ],

    maximumFileSizeMb: 10,
    introductionMaximumLength: 500,
    synopsisMaximumLength: 1000,
};

export const AUTHOR_APPLICATION_RESULT_MOCK:
    AuthorApplicationResult = {
    applicationId: 'AUTHOR-APPLICATION-2026-001',
    submittedAt: new Date().toISOString(),
    message:
        'Yêu cầu của bạn đã được gửi. Hồ sơ sẽ được xem xét trong 3–5 ngày làm việc.',
};