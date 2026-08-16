import type {
  AuthorDirectoryDto,
  AuthorDirectoryItemDto,
  NewAuthorItemDto,
} from '../dto';
import type {
  AuthorProfileAggregateRecord,
  AuthorProfileListRecord,
  AuthorProfileNewRecord,
} from '../ports';

export class AuthorDirectoryMapper {
  static toDto(
    authors: readonly AuthorProfileListRecord[],
    newAuthors: readonly AuthorProfileNewRecord[],
    aggregate: AuthorProfileAggregateRecord,
  ): AuthorDirectoryDto {
    const sortedAuthors = [...authors].sort((first, second) => {
      const firstRank = first.featuredRank ?? Number.MAX_SAFE_INTEGER;
      const secondRank = second.featuredRank ?? Number.MAX_SAFE_INTEGER;

      return (
        firstRank - secondRank || second.followerCount - first.followerCount
      );
    });

    return {
      authors: sortedAuthors.map((author, index): AuthorDirectoryItemDto => {
        const genre =
          author.stories[0]?.categories[0]?.category.name ?? 'Đa thể loại';
        const reads = AuthorDirectoryMapper.safeNumber(author.totalReadCount);

        return {
          id: author.userId,
          slug: author.slug,
          name: author.penName,
          initials: AuthorDirectoryMapper.initials(author.penName),
          genre,
          description: AuthorDirectoryMapper.summary(author.biography),
          verified: author.verificationStatus === 'VERIFIED',
          worksLabel: AuthorDirectoryMapper.formatCompact(author.storyCount),
          readsLabel: AuthorDirectoryMapper.formatCompact(
            author.totalReadCount,
          ),
          followersLabel: AuthorDirectoryMapper.formatCompact(
            author.followerCount,
          ),
          works: author.storyCount,
          reads,
          followers: author.followerCount,
          featuredRank: author.featuredRank ?? 10_000 + index,
        };
      }),
      statistics: {
        authors: AuthorDirectoryMapper.formatCompact(aggregate.totalAuthors),
        works: AuthorDirectoryMapper.formatCompact(aggregate.totalStories ?? 0),
        reads: AuthorDirectoryMapper.formatCompact(aggregate.totalReads ?? 0n),
        followers: AuthorDirectoryMapper.formatCompact(
          aggregate.totalFollowers ?? 0,
        ),
      },
      newAuthors: newAuthors.map((author): NewAuthorItemDto => ({
        id: author.userId,
        slug: author.slug,
        name: author.penName,
        initials: AuthorDirectoryMapper.initials(author.penName),
        worksLabel: AuthorDirectoryMapper.formatCompact(author.storyCount),
        readsLabel: AuthorDirectoryMapper.formatCompact(author.totalReadCount),
        verified: author.verificationStatus === 'VERIFIED',
      })),
    };
  }

  private static initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('vi');

    return `${words[0][0] ?? ''}${words[words.length - 1][0] ?? ''}`.toLocaleUpperCase(
      'vi',
    );
  }

  private static summary(value: string | null): string {
    if (!value?.trim()) {
      return 'Tác giả chưa cập nhật phần giới thiệu.';
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= 180
      ? normalized
      : `${normalized.slice(0, 177)}...`;
  }

  private static formatCompact(value: bigint | number): string {
    const numericValue = typeof value === 'bigint' ? Number(value) : value;

    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numericValue);
  }

  private static safeNumber(value: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > max ? max : value);
  }
}
