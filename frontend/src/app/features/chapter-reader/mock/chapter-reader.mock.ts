
import { ChapterReaderView } from '../domain/chapter-reader.models';

export const CHAPTER_READER_MOCK: ChapterReaderView = {
    story: {
        id: 'story-dau-pha-thuong-khung',
        slug: 'dau-pha-thuong-khung',
        title: 'Đấu Phá Thương Khung',
    },

    chapter: {
        id: 'chapter-1',
        number: 1,
        title: 'Giới thiệu',
        publishedAt: '01/05/2025 10:00',
        views: 3256,

        paragraphs: [
            'Ba năm trước, Tiêu Viêm, một thiên tài tu luyện của gia tộc Tiêu gia, bất ngờ mất hết sức mạnh tu luyện.',

            'Ba năm sau, khi mọi người đã dần quên đi thiên tài từng một thời làm mưa làm gió, thì cậu bé ấy, Tiêu Viêm, lại một lần nữa bước lên con đường tu luyện, viết nên huyền thoại của riêng mình.',

            '---',

            '“Vận mệnh? Ha ha... Nếu ông trời đã muốn ta như vậy, vậy ta sẽ nghịch thiên mà đi!”',

            'Tiêu Viêm nắm chặt tay, ánh mắt kiên định, ngẩng đầu nhìn bầu trời xa xăm.',

            '“Từ nay về sau, ta không còn là phế vật!”',

            '---',

            'Từ một thiếu niên bị chế giễu, trở thành cường giả đứng trên đỉnh cao của đấu khí đại lục, hành trình của Tiêu Viêm chính thức bắt đầu từ đây...',
        ],
    },

    navigation: {
        previous: {
            number: 0,
            title: 'Dẫn nhập',
            url: '/truyen/dau-pha-thuong-khung/chuong/0',
        },

        next: {
            number: 2,
            title: 'Gia tộc suy yếu',
            url: '/truyen/dau-pha-thuong-khung/chuong/2',
        },
    },

    totalComments: 128,

    comments: [
        {
            id: 'comment-1',
            author: {
                name: 'HuyềnThiên',
                level: 23,
                initials: 'HT',
            },
            content:
                'Chương mở đầu hay quá! Mong chờ hành trình của Tiêu Viêm phía trước!',
            createdAt: '2 giờ trước',
            likes: 34,
        },
        {
            id: 'comment-2',
            author: {
                name: 'LinhNhi',
                level: 18,
                initials: 'LN',
            },
            content:
                'Câu nói “Nếu ông trời đã muốn ta như vậy, vậy ta sẽ nghịch thiên mà đi!” quá đỉnh!',
            createdAt: '3 giờ trước',
            likes: 27,
        },
    ],
};