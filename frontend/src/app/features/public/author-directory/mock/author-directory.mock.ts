
import { AuthorDirectoryView } from '../domain/author-directory.models';

export const AUTHOR_DIRECTORY_MOCK: AuthorDirectoryView = {
    statistics: {
        authors: '1,248',
        works: '8,752',
        reads: '24.6B',
        followers: '3.2M',
    },

    authors: [
        {
            id: 'author-nhi-can',
            slug: 'nhi-can',
            name: 'Nhĩ Căn',
            initials: 'NC',
            genre: 'Tiên hiệp',
            description:
                'Tác giả nổi tiếng với phong cách viết chắc tay, logic và chiều sâu triết lý.',
            verified: true,

            worksLabel: '9',
            readsLabel: '1.25B',
            followersLabel: '128.6K',

            works: 9,
            reads: 1_250_000_000,
            followers: 128_600,
            featuredRank: 1,
        },
        {
            id: 'author-thien-tam-tho-dau',
            slug: 'thien-tam-tho-dau',
            name: 'Thiên Tằm Thổ Đậu',
            initials: 'TK',
            genre: 'Huyền huyễn',
            description:
                'Bậc thầy trong việc xây dựng thế giới rộng lớn và hệ thống tu luyện đặc sắc.',
            verified: true,

            worksLabel: '8',
            readsLabel: '952M',
            followersLabel: '96.3K',

            works: 8,
            reads: 952_000_000,
            followers: 96_300,
            featuredRank: 2,
        },
        {
            id: 'author-da-vu',
            slug: 'da-vu',
            name: 'Dạ Vũ',
            initials: 'DV',
            genre: 'Đô thị',
            description:
                'Chuyên viết truyện đô thị, hệ thống và hành động kịch tính.',
            verified: true,

            worksLabel: '7',
            readsLabel: '785M',
            followersLabel: '88.7K',

            works: 7,
            reads: 785_000_000,
            followers: 88_700,
            featuredRank: 3,
        },
        {
            id: 'author-mong-nhap-than-co',
            slug: 'mong-nhap-than-co',
            name: 'Mộng Nhập Thần Cơ',
            initials: 'MN',
            genre: 'Lịch sử',
            description:
                'Kết hợp lịch sử và huyền huyễn tạo nên những câu chuyện độc đáo.',
            verified: true,

            worksLabel: '6',
            readsLabel: '632M',
            followersLabel: '75.2K',

            works: 6,
            reads: 632_000_000,
            followers: 75_200,
            featuredRank: 4,
        },
        {
            id: 'author-huyen-huyen-vu',
            slug: 'huyen-huyen-vu',
            name: 'Huyền Huyễn Vũ',
            initials: 'HV',
            genre: 'Huyền huyễn',
            description:
                'Tác giả của những bộ truyện có cốt truyện lôi cuốn và nhân vật ấn tượng.',
            verified: true,

            worksLabel: '5',
            readsLabel: '521M',
            followersLabel: '68.9K',

            works: 5,
            reads: 521_000_000,
            followers: 68_900,
            featuredRank: 5,
        },
        {
            id: 'author-ech-ngoi-day-gieng',
            slug: 'ech-ngoi-day-gieng',
            name: 'Ếch Ngồi Đáy Giếng',
            initials: 'EG',
            genre: 'Tiên hiệp',
            description:
                'Văn phong hài hước, sáng tạo, mang đến những trải nghiệm mới lạ.',
            verified: true,

            worksLabel: '6',
            readsLabel: '498M',
            followersLabel: '64.1K',

            works: 6,
            reads: 498_000_000,
            followers: 64_100,
            featuredRank: 6,
        },
        {
            id: 'author-ha-ngon',
            slug: 'ha-ngon',
            name: 'Hạ Ngôn',
            initials: 'HN',
            genre: 'Ngôn tình',
            description:
                'Ngòi bút tinh tế trong việc khắc họa cảm xúc, tình yêu và các mối quan hệ.',
            verified: true,

            worksLabel: '12',
            readsLabel: '412M',
            followersLabel: '59.8K',

            works: 12,
            reads: 412_000_000,
            followers: 59_800,
            featuredRank: 7,
        },
        {
            id: 'author-co-mac',
            slug: 'co-mac',
            name: 'Cổ Mặc',
            initials: 'CM',
            genre: 'Kiếm hiệp',
            description:
                'Những câu chuyện giang hồ giàu cảm xúc, đậm tinh thần hiệp nghĩa.',
            verified: true,

            worksLabel: '7',
            readsLabel: '401M',
            followersLabel: '58.3K',

            works: 7,
            reads: 401_000_000,
            followers: 58_300,
            featuredRank: 8,
        },
        {
            id: 'author-phong-lang-thien-ha',
            slug: 'phong-lang-thien-ha',
            name: 'Phong Lăng Thiên Hạ',
            initials: 'PL',
            genre: 'Võng du',
            description:
                'Nổi bật với thế giới trò chơi rộng lớn và những trận chiến hấp dẫn.',
            verified: true,

            worksLabel: '5',
            readsLabel: '364M',
            followersLabel: '52.6K',

            works: 5,
            reads: 364_000_000,
            followers: 52_600,
            featuredRank: 9,
        },
        {
            id: 'author-phat-tieu-dich-oa-nguu',
            slug: 'phat-tieu-dich-oa-nguu',
            name: 'Phát Tiêu Đích Oa Ngưu',
            initials: 'PT',
            genre: 'Khoa huyễn',
            description:
                'Tác giả chuyên khai thác công nghệ, tương lai và những thế giới giả tưởng.',
            verified: true,

            worksLabel: '6',
            readsLabel: '320M',
            followersLabel: '49.7K',

            works: 6,
            reads: 320_000_000,
            followers: 49_700,
            featuredRank: 10,
        },
    ],

    newAuthors: [
        {
            id: 'new-author-luc-tieu-phung',
            slug: 'luc-tieu-phung',
            name: 'Lục Tiêu Phụng',
            initials: 'LT',
            worksLabel: '2 tác phẩm',
            readsLabel: '12.4K',
            verified: true,
        },
        {
            id: 'new-author-van-hi',
            slug: 'van-hi',
            name: 'Vân Hi',
            initials: 'VH',
            worksLabel: '1 tác phẩm',
            readsLabel: '8.7K',
            verified: true,
        },
        {
            id: 'new-author-mac-thien',
            slug: 'mac-thien',
            name: 'Mặc Thiên',
            initials: 'MT',
            worksLabel: '3 tác phẩm',
            readsLabel: '15.2K',
            verified: true,
        },
        {
            id: 'new-author-am-tich',
            slug: 'am-tich',
            name: 'Âm Tịch',
            initials: 'AT',
            worksLabel: '2 tác phẩm',
            readsLabel: '9.1K',
            verified: true,
        },
        {
            id: 'new-author-diep-giai',
            slug: 'diep-giai',
            name: 'Diệp Giai',
            initials: 'DG',
            worksLabel: '1 tác phẩm',
            readsLabel: '6.3K',
            verified: true,
        },
    ],
};