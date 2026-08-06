import {
    GenreRankingDistribution,
    StoryRankingItem,
} from '../domain/story-ranking.models';

export const STORY_RANKING_ITEMS_MOCK:
    readonly StoryRankingItem[] = [
        {
            id: 'story-solo-leveling',
            slug: 'solo-leveling',

            rank: 1,
            rankChange: 2,

            title: 'Solo Leveling',
            authorName: 'Chugong',

            coverUrl:
                '/assets/mock/stories/solo-leveling.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'fantasy',
                    name: 'Fantasy',
                },
            ],

            latestChapter: 181,

            viewCount: 72_100_000,

            rating: 9.7,
            ratingCount: 312_400,

            followerCount: 2_450_000,

            popularityScore: 98,
            trendingScore: 100,
        },
        {
            id: 'story-omniscient',
            slug:
                'omniscient-readers-viewpoint',

            rank: 2,
            rankChange: -1,

            title:
                "Omniscient Reader's Viewpoint",

            authorName:
                'Sing Shong',

            coverUrl:
                '/assets/mock/stories/omniscient-readers-viewpoint.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'fantasy',
                    name: 'Fantasy',
                },
            ],

            latestChapter: 236,

            viewCount: 58_700_000,

            rating: 9.6,
            ratingCount: 245_300,

            followerCount: 2_180_000,

            popularityScore: 96,
            trendingScore: 94,
        },
        {
            id: 'story-attack-on-titan',
            slug: 'attack-on-titan',

            rank: 3,
            rankChange: 0,

            title: 'Attack on Titan',
            authorName:
                'Hajime Isayama',

            coverUrl:
                '/assets/mock/stories/attack-on-titan.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'drama',
                    name: 'Drama',
                },
            ],

            latestChapter: 139,

            viewCount: 45_200_000,

            rating: 9.5,
            ratingCount: 198_700,

            followerCount: 1_930_000,

            popularityScore: 94,
            trendingScore: 88,
        },
        {
            id: 'story-jujutsu-kaisen',
            slug: 'jujutsu-kaisen',

            rank: 4,
            rankChange: 1,

            title: 'Jujutsu Kaisen',
            authorName:
                'Gege Akutami',

            coverUrl:
                '/assets/mock/stories/jujutsu-kaisen.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'supernatural',
                    name: 'Supernatural',
                },
            ],

            latestChapter: 260,

            viewCount: 34_600_000,

            rating: 9.4,
            ratingCount: 176_200,

            followerCount: 1_720_000,

            popularityScore: 92,
            trendingScore: 84,
        },
        {
            id: 'story-kimetsu',
            slug: 'kimetsu-no-yaiba',

            rank: 5,
            rankChange: -1,

            title: 'Kimetsu no Yaiba',
            authorName:
                'Koyoharu Gotouge',

            coverUrl:
                '/assets/mock/stories/kimetsu-no-yaiba.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'historical',
                    name: 'Historical',
                },
            ],

            latestChapter: 205,

            viewCount: 32_100_000,

            rating: 9.3,
            ratingCount: 167_800,

            followerCount: 1_680_000,

            popularityScore: 91,
            trendingScore: 82,
        },
        {
            id: 'story-one-piece',
            slug: 'one-piece',

            rank: 6,
            rankChange: 2,

            title: 'One Piece',
            authorName:
                'Eiichiro Oda',

            coverUrl:
                '/assets/mock/stories/one-piece.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'phieu-luu',
                    name: 'Adventure',
                },
            ],

            latestChapter: 1115,

            viewCount: 31_800_000,

            rating: 9.2,
            ratingCount: 210_300,

            followerCount: 2_760_000,

            popularityScore: 90,
            trendingScore: 78,
        },
        {
            id: 'story-chainsaw-man',
            slug: 'chainsaw-man',

            rank: 7,
            rankChange: 0,

            title: 'Chainsaw Man',
            authorName:
                'Tatsuki Fujimoto',

            coverUrl:
                '/assets/mock/stories/chainsaw-man.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'kinh-di',
                    name: 'Horror',
                },
            ],

            latestChapter: 167,

            viewCount: 25_700_000,

            rating: 9.1,
            ratingCount: 142_100,

            followerCount: 1_420_000,

            popularityScore: 87,
            trendingScore: 75,
        },
        {
            id: 'story-beginning-after-end',
            slug:
                'the-beginning-after-the-end',

            rank: 8,
            rankChange: 1,

            title:
                'The Beginning After the End',

            authorName:
                'TurtleMe',

            coverUrl:
                '/assets/mock/stories/the-beginning-after-the-end.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'fantasy',
                    name: 'Fantasy',
                },
            ],

            latestChapter: 189,

            viewCount: 22_400_000,

            rating: 9,
            ratingCount: 128_500,

            followerCount: 1_350_000,

            popularityScore: 84,
            trendingScore: 73,
        },
        {
            id: 'story-wind-breaker',
            slug: 'wind-breaker',

            rank: 9,
            rankChange: -2,

            title: 'Wind Breaker',
            authorName:
                'Jo Yongseok',

            coverUrl:
                '/assets/mock/stories/wind-breaker.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'school-life',
                    name: 'School Life',
                },
            ],

            latestChapter: 145,

            viewCount: 18_900_000,

            rating: 8.9,
            ratingCount: 96_400,

            followerCount: 1_120_000,

            popularityScore: 80,
            trendingScore: 69,
        },
        {
            id: 'story-tokyo-revengers',
            slug: 'tokyo-revengers',

            rank: 10,
            rankChange: 0,

            title: 'Tokyo Revengers',
            authorName:
                'Ken Wakui',

            coverUrl:
                '/assets/mock/stories/tokyo-revengers.webp',

            genres: [
                {
                    slug: 'hanh-dong',
                    name: 'Action',
                },
                {
                    slug: 'drama',
                    name: 'Drama',
                },
            ],

            latestChapter: 278,

            viewCount: 16_200_000,

            rating: 8.8,
            ratingCount: 88_900,

            followerCount: 980_000,

            popularityScore: 76,
            trendingScore: 65,
        },
    ];

export const GENRE_RANKING_DISTRIBUTION_MOCK:
    readonly GenreRankingDistribution[] = [
        {
            slug: 'hanh-dong',
            name: 'Action',
            percentage: 38,
            tone: 'purple',
        },
        {
            slug: 'fantasy',
            name: 'Fantasy',
            percentage: 24,
            tone: 'blue',
        },
        {
            slug: 'romance',
            name: 'Romance',
            percentage: 16,
            tone: 'pink',
        },
        {
            slug: 'hai-huoc',
            name: 'Comedy',
            percentage: 12,
            tone: 'orange',
        },
        {
            slug: 'drama',
            name: 'Drama',
            percentage: 10,
            tone: 'green',
        },
    ];