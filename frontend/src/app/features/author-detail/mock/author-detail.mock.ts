
import { AuthorDetailView } from '../domain/author-detail.models';

export const AUTHOR_DETAIL_MOCK: AuthorDetailView = {
    profile: {
        id: 'author-nhi-can',
        slug: 'nhi-can',
        name: 'Nhĩ Căn',
        initials: 'NC',
        headline: 'Tác giả tiên hiệp nổi bật',
        country: 'Trung Quốc',
        penName: 'Nhĩ Căn',
        joinedAt: '2009',
        verified: true,

        biography: [
            'Nhĩ Căn là một trong những tác giả tiên hiệp hàng đầu Trung Quốc, nổi tiếng với phong cách viết mạch lạc, thế giới quan rộng lớn và hệ thống nhân vật có chiều sâu.',

            'Các tác phẩm của ông thường mang màu sắc triết lý, khắc họa con đường tu luyện đầy gian nan và khát vọng vượt lên số phận.',

            'Văn phong của Nhĩ Căn kết hợp giữa hào hùng và trầm mặc, xây dựng nên những thế giới huyền ảo nhưng vẫn giữ được chiều sâu cảm xúc.',

            'Ông được độc giả yêu mến qua hàng loạt bộ truyện kinh điển, đóng góp lớn cho dòng truyện tiên hiệp hiện đại.',
        ],
    },

    statistics: {
        totalWorks: 9,
        followers: '128,6K',
        totalReads: '1,25B',
        averageRating: '9,3/10',
    },

    featuredWorks: [
        {
            id: 'work-pham-nhan-tu-tien',
            slug: 'pham-nhan-tu-tien',
            title: 'Phàm Nhân Tu Tiên',
            description:
                'Từ một phàm nhân bình thường, bước lên con đường tu tiên đầy gian nan.',
            genres: ['Tiên hiệp', 'Tu chân'],
            chapters: 2437,
            rating: '9.4',
            reads: '286,4K',
            tone: 'blue',
        },
        {
            id: 'work-tien-nghich',
            slug: 'tien-nghich',
            title: 'Tiên Nghịch',
            description:
                'Nghịch thiên cải mệnh, chỉ vì một niềm bất khuất.',
            genres: ['Tiên hiệp', 'Huyền huyễn'],
            chapters: 2088,
            rating: '9.3',
            reads: '254,8K',
            tone: 'gold',
        },
        {
            id: 'work-nga-duc-phong-thien',
            slug: 'nga-duc-phong-thien',
            title: 'Ngã Dục Phong Thiên',
            description:
                'Một đời tranh đấu, chỉ để phong thiên lập địa.',
            genres: ['Tiên hiệp', 'Huyền huyễn'],
            chapters: 1632,
            rating: '9.2',
            reads: '198,7K',
            tone: 'cyan',
        },
        {
            id: 'work-cau-ma',
            slug: 'cau-ma',
            title: 'Cầu Ma',
            description:
                'Ma đạo tranh chấp, ai mới là chân chính cứu thiên?',
            genres: ['Tiên hiệp', 'Huyền huyễn'],
            chapters: 1452,
            rating: '9.1',
            reads: '162,3K',
            tone: 'violet',
        },
    ],

    timeline: [
        {
            year: '2009',
            title: 'Bắt đầu sự nghiệp',
            description: 'Bắt đầu sáng tác tiểu thuyết mạng.',
        },
        {
            year: '2011',
            title: 'Phàm Nhân Tu Tiên',
            description: 'Tác phẩm đầu tiên đạt thành công lớn.',
        },
        {
            year: '2013',
            title: 'Tác giả được yêu thích',
            description: 'Trở thành tên tuổi nổi bật của dòng tiên hiệp.',
        },
        {
            year: '2017',
            title: 'Tiên Nghịch đạt hàng tỷ lượt đọc',
            description: 'Được chuyển thể và phát hành tại nhiều thị trường.',
        },
        {
            year: '2022',
            title: 'Tiếp tục sáng tác',
            description: 'Gắn bó cùng cộng đồng độc giả.',
        },
    ],

    recentUpdates: [
        {
            id: 'update-1',
            workTitle: 'Tiên Nghịch',
            chapterTitle: 'Chương 2088',
            updatedAt: '10/05/2024',
        },
        {
            id: 'update-2',
            workTitle: 'Phàm Nhân Tu Tiên',
            chapterTitle: 'Chương 2437',
            updatedAt: '08/05/2024',
        },
        {
            id: 'update-3',
            workTitle: 'Ngã Dục Phong Thiên',
            chapterTitle: 'Chương 1632',
            updatedAt: '05/05/2024',
        },
        {
            id: 'update-4',
            workTitle: 'Cầu Ma',
            chapterTitle: 'Chương 1457',
            updatedAt: '02/05/2024',
        },
        {
            id: 'update-5',
            workTitle: 'Vũ Động Càn Khôn',
            chapterTitle: 'Chương 3521',
            updatedAt: '30/04/2024',
        },
    ],

    hotWorks: [
        {
            rank: 1,
            title: 'Phàm Nhân Tu Tiên',
            genre: 'Tiên hiệp',
            reads: '286,4K',
            tone: 'blue',
        },
        {
            rank: 2,
            title: 'Tiên Nghịch',
            genre: 'Tiên hiệp',
            reads: '254,8K',
            tone: 'gold',
        },
        {
            rank: 3,
            title: 'Ngã Dục Phong Thiên',
            genre: 'Tiên hiệp',
            reads: '198,7K',
            tone: 'cyan',
        },
        {
            rank: 4,
            title: 'Cầu Ma',
            genre: 'Tiên hiệp',
            reads: '162,3K',
            tone: 'violet',
        },
        {
            rank: 5,
            title: 'Vũ Động Càn Khôn',
            genre: 'Tiên hiệp',
            reads: '155,6K',
            tone: 'crimson',
        },
    ],
};