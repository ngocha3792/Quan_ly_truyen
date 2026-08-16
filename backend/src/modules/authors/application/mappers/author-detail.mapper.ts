import type { AuthorDetailDto, AuthorWorkDto, AuthorWorkTone } from '../dto';
import type { AuthorProfileDetailRecord, RecentChapterRecord } from '../ports';

const WORK_TONES: readonly AuthorWorkTone[] = [
  'blue',
  'gold',
  'cyan',
  'violet',
  'crimson',
];

export class AuthorDetailMapper {
  static toDto(
    author: AuthorProfileDetailRecord,
    recentChapters: readonly RecentChapterRecord[],
  ): AuthorDetailDto {
    const mainGenre =
      author.stories[0]?.categories[0]?.category.name ?? 'TruyenHub';
    const weightedRating = AuthorDetailMapper.weightedAverageRating(
      author.stories,
    );
    const socialLinks = AuthorDetailMapper.asRecord(author.socialLinks);
    const firstPublishedStory = [...author.stories]
      .filter((story) => story.publishedAt !== null)
      .sort(
        (first, second) =>
          first.publishedAt!.getTime() - second.publishedAt!.getTime(),
      )[0];

    const timeline = [
      {
        year: String(author.createdAt.getFullYear()),
        title: 'Gia nhập TruyenHub',
        description: `${author.penName} bắt đầu hoạt động trên nền tảng.`,
      },
      ...(firstPublishedStory?.publishedAt
        ? [
            {
              year: String(firstPublishedStory.publishedAt.getFullYear()),
              title: firstPublishedStory.title,
              description: 'Tác phẩm công khai đầu tiên trên TruyenHub.',
            },
          ]
        : []),
      ...(author.verifiedAt
        ? [
            {
              year: String(author.verifiedAt.getFullYear()),
              title: 'Tác giả đã xác minh',
              description: 'Hồ sơ tác giả được TruyenHub xác minh.',
            },
          ]
        : []),
    ];

    return {
      profile: {
        id: author.userId,
        slug: author.slug,
        name: author.penName,
        initials: AuthorDetailMapper.initials(author.penName),
        headline: `Tác giả ${mainGenre.toLocaleLowerCase('vi')} trên TruyenHub`,
        country:
          AuthorDetailMapper.stringValue(socialLinks['country']) ??
          'Không công khai',
        penName: author.penName,
        joinedAt: String(author.createdAt.getFullYear()),
        verified: author.verificationStatus === 'VERIFIED',
        avatarUrl:
          author.user.avatarMedia?.status === 'READY' && !author.user.avatarMedia.deletedAt
            ? author.user.avatarMedia.secureUrl ?? author.user.avatarMedia.publicUrl ?? null
            : null,
        bannerUrl:
          author.bannerMedia?.status === 'READY' && !author.bannerMedia.deletedAt
            ? author.bannerMedia.secureUrl ?? author.bannerMedia.publicUrl ?? null
            : null,
        socialLinks: {
          website: author.websiteUrl,
          facebook: AuthorDetailMapper.stringValue(socialLinks['facebook']),
          instagram: AuthorDetailMapper.stringValue(socialLinks['instagram']),
          x: AuthorDetailMapper.stringValue(socialLinks['x']),
          youtube: AuthorDetailMapper.stringValue(socialLinks['youtube']),
          tiktok: AuthorDetailMapper.stringValue(socialLinks['tiktok']),
        },
        biography: AuthorDetailMapper.biography(author.biography),
      },
      statistics: {
        totalWorks: author.storyCount,
        followers: AuthorDetailMapper.formatCompact(author.followerCount),
        followersCount: author.followerCount,
        totalReads: AuthorDetailMapper.formatCompact(author.totalReadCount),
        averageRating: `${weightedRating.toFixed(1)}/10`,
      },
      featuredWorks: author.stories
        .slice(0, 4)
        .map((story, index): AuthorWorkDto => ({
          id: story.id,
          slug: story.slug,
          title: story.title,
          description: story.synopsis,
          genres: story.categories.map((category) => category.category.name),
          chapters: story.chapterCount,
          rating: Number(story.ratingAverage.toString()).toFixed(1),
          reads: AuthorDetailMapper.formatCompact(story.viewCount),
          tone: WORK_TONES[index % WORK_TONES.length],
        })),
      timeline,
      recentUpdates: recentChapters.map((chapter) => ({
        id: chapter.id,
        workTitle: chapter.story.title,
        chapterTitle: `Chương ${AuthorDetailMapper.chapterNumber(chapter.number)}: ${chapter.title}`,
        updatedAt: AuthorDetailMapper.formatDate(
          chapter.publishedAt ?? chapter.updatedAt,
        ),
      })),
      hotWorks: author.stories.slice(0, 5).map((story, index) => ({
        rank: index + 1,
        title: story.title,
        genre: story.categories[0]?.category.name ?? 'Đa thể loại',
        reads: AuthorDetailMapper.formatCompact(story.viewCount),
        tone: WORK_TONES[index % WORK_TONES.length],
      })),
    };
  }

  private static weightedAverageRating(
    stories: readonly {
      readonly ratingAverage: { toString(): string };
      readonly ratingCount: number;
    }[],
  ): number {
    const totalRatings = stories.reduce(
      (sum, story) => sum + story.ratingCount,
      0,
    );

    if (totalRatings === 0) return 0;

    return (
      stories.reduce(
        (sum, story) =>
          sum + Number(story.ratingAverage.toString()) * story.ratingCount,
        0,
      ) / totalRatings
    );
  }

  private static biography(value: string | null): readonly string[] {
    if (!value?.trim()) {
      return ['Tác giả chưa cập nhật tiểu sử.'];
    }

    const paragraphs = value
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    return paragraphs.length > 0 ? paragraphs : [value.trim()];
  }

  private static initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('vi');

    return `${words[0][0] ?? ''}${words[words.length - 1][0] ?? ''}`.toLocaleUpperCase(
      'vi',
    );
  }

  private static formatCompact(value: bigint | number): string {
    const numericValue = typeof value === 'bigint' ? Number(value) : value;

    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numericValue);
  }

  private static chapterNumber(value: { toString(): string }): string {
    return value.toString().replace(/\.00$/, '');
  }

  private static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  private static asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private static stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
