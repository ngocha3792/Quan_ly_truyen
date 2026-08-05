import {
    GenreRankingItem,
    GenreSummary,
    GenreTrendingItem,
} from '../domain/genre-discovery.models';

export const GENRE_SUMMARIES_MOCK:
    readonly GenreSummary[] = [
        {
            id: 'genre-action',
            slug: 'hanh-dong',

            name: 'Hành động',

            description:
                'Chiến đấu, võ thuật, sức mạnh và những cuộc đối đầu kịch tính.',

            visual: 'action',
            tone: 'red',

            storyCount: 2845,

            coverUrl:
                '/assets/mock/genres/action.webp',
        },
        {
            id: 'genre-fantasy',
            slug: 'fantasy',

            name: 'Fantasy',

            description:
                'Ma thuật, thế giới khác và những điều kỳ diệu.',

            visual: 'fantasy',
            tone: 'violet',

            storyCount: 2312,

            coverUrl:
                '/assets/mock/genres/fantasy.webp',
        },
        {
            id: 'genre-romance',
            slug: 'romance',

            name: 'Romance',

            description:
                'Tình yêu, cảm xúc và những khoảnh khắc ngọt ngào.',

            visual: 'romance',
            tone: 'pink',

            storyCount: 1986,

            coverUrl:
                '/assets/mock/genres/romance.webp',
        },
        {
            id: 'genre-comedy',
            slug: 'hai-huoc',

            name: 'Comedy',

            description:
                'Hài hước, dí dỏm và những tình huống vui nhộn.',

            visual: 'comedy',
            tone: 'yellow',

            storyCount: 1652,

            coverUrl:
                '/assets/mock/genres/comedy.webp',
        },
        {
            id: 'genre-manhwa',
            slug: 'manhwa',

            name: 'Manhwa',

            description:
                'Truyện tranh Hàn Quốc được yêu thích nhất.',

            visual: 'manhwa',
            tone: 'purple',

            storyCount: 4128,

            coverUrl: null,
        },
        {
            id: 'genre-manhua',
            slug: 'manhua',

            name: 'Manhua',

            description:
                'Truyện tranh Trung Quốc với nét vẽ đặc sắc.',

            visual: 'manhua',
            tone: 'orange',

            storyCount: 2764,

            coverUrl: null,
        },
        {
            id: 'genre-horror',
            slug: 'kinh-di',

            name: 'Kinh dị',

            description:
                'Những câu chuyện rùng rợn, bí ẩn và ám ảnh.',

            visual: 'horror',
            tone: 'gray',

            storyCount: 1287,

            coverUrl: null,
        },
        {
            id: 'genre-drama',
            slug: 'drama',

            name: 'Drama',

            description:
                'Cốt truyện sâu sắc, kịch tính và nhiều cảm xúc.',

            visual: 'drama',
            tone: 'blue',

            storyCount: 1935,

            coverUrl: null,
        },
        {
            id: 'genre-adventure',
            slug: 'phieu-luu',

            name: 'Phiêu lưu',

            description:
                'Hành trình khám phá thế giới và những bí ẩn.',

            visual: 'adventure',
            tone: 'blue',

            storyCount: 1742,

            coverUrl: null,
        },
        {
            id: 'genre-school-life',
            slug: 'school-life',

            name: 'School Life',

            description:
                'Cuộc sống học đường với tình bạn và kỷ niệm.',

            visual: 'school-life',
            tone: 'gray',

            storyCount: 1516,

            coverUrl: null,
        },
        {
            id: 'genre-sci-fi',
            slug: 'sci-fi',

            name: 'Sci-fi',

            description:
                'Khoa học viễn tưởng, công nghệ và tương lai huyền bí.',

            visual: 'sci-fi',
            tone: 'gray',

            storyCount: 986,

            coverUrl: null,
        },
        {
            id: 'genre-isekai',
            slug: 'isekai',

            name: 'Isekai',

            description:
                'Xuyên không đến thế giới khác và bắt đầu cuộc sống mới.',

            visual: 'isekai',
            tone: 'purple',

            storyCount: 1195,

            coverUrl: null,
        },
    ];

export const GENRE_FEATURED_MOCK:
    readonly GenreSummary[] =
    GENRE_SUMMARIES_MOCK.slice(0, 4);

export const GENRE_RANKING_MOCK:
    readonly GenreRankingItem[] = [
        {
            id: 'genre-action',
            slug: 'hanh-dong',
            name: 'Hành động',
            storyCount: 2845,
            rank: 1,
            tone: 'red',
        },
        {
            id: 'genre-fantasy',
            slug: 'fantasy',
            name: 'Fantasy',
            storyCount: 2312,
            rank: 2,
            tone: 'violet',
        },
        {
            id: 'genre-romance',
            slug: 'romance',
            name: 'Romance',
            storyCount: 1986,
            rank: 3,
            tone: 'pink',
        },
        {
            id: 'genre-comedy',
            slug: 'hai-huoc',
            name: 'Comedy',
            storyCount: 1652,
            rank: 4,
            tone: 'yellow',
        },
        {
            id: 'genre-manhwa',
            slug: 'manhwa',
            name: 'Manhwa',
            storyCount: 4128,
            rank: 5,
            tone: 'purple',
        },
    ];

export const GENRE_TRENDING_MOCK:
    readonly GenreTrendingItem[] = [
        {
            id: 'trend-action',
            slug: 'hanh-dong',
            name: 'Hành động',

            coverUrl:
                '/assets/mock/genres/action.webp',

            percent: 42.5,
            readingCount: 385000,

            tone: 'red',
        },
        {
            id: 'trend-fantasy',
            slug: 'fantasy',
            name: 'Fantasy',

            coverUrl:
                '/assets/mock/genres/fantasy.webp',

            percent: 27.3,
            readingCount: 247000,

            tone: 'violet',
        },
        {
            id: 'trend-romance',
            slug: 'romance',
            name: 'Romance',

            coverUrl:
                '/assets/mock/genres/romance.webp',

            percent: 13.8,
            readingCount: 125000,

            tone: 'pink',
        },
        {
            id: 'trend-manhwa',
            slug: 'manhwa',
            name: 'Manhwa',

            coverUrl:
                '/assets/mock/genres/default.webp',

            percent: 9.7,
            readingCount: 88000,

            tone: 'purple',
        },
        {
            id: 'trend-comedy',
            slug: 'hai-huoc',
            name: 'Comedy',

            coverUrl:
                '/assets/mock/genres/comedy.webp',

            percent: 6.7,
            readingCount: 61000,

            tone: 'yellow',
        },
    ];