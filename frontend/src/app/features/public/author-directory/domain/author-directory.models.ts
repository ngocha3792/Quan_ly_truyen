
export type AuthorDirectorySort =
    | 'featured'
    | 'followers'
    | 'reads'
    | 'works'
    | 'name';

export interface AuthorDirectoryItem {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly initials: string;
    readonly genre: string;
    readonly description: string;
    readonly verified: boolean;

    readonly worksLabel: string;
    readonly readsLabel: string;
    readonly followersLabel: string;

    readonly works: number;
    readonly reads: number;
    readonly followers: number;
    readonly featuredRank: number;
}

export interface AuthorDirectoryStatistics {
    readonly authors: string;
    readonly works: string;
    readonly reads: string;
    readonly followers: string;
}

export interface NewAuthorItem {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly initials: string;
    readonly worksLabel: string;
    readonly readsLabel: string;
    readonly verified: boolean;
}

export interface AuthorDirectoryView {
    readonly authors: readonly AuthorDirectoryItem[];
    readonly statistics: AuthorDirectoryStatistics;
    readonly newAuthors: readonly NewAuthorItem[];
}