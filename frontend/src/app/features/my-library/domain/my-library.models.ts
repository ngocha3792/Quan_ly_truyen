
export type LibraryFilter =
    | 'all'
    | 'reading'
    | 'following'
    | 'favorite'
    | 'completed';

export type LibrarySort =
    | 'recent'
    | 'progress'
    | 'title'
    | 'chapter';

export type LibraryViewMode =
    | 'grid'
    | 'list';

export type LibraryCoverTone =
    | 'blue'
    | 'violet'
    | 'orange'
    | 'gold'
    | 'cyan'
    | 'silver'
    | 'crimson'
    | 'indigo';

export interface LibraryStory {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly author: string;
    readonly genres: readonly string[];

    readonly currentChapter: number;
    readonly latestChapter: number;
    readonly progress: number;

    readonly lastReadLabel: string;
    readonly lastReadMinutes: number;

    readonly isReading: boolean;
    readonly isFollowing: boolean;
    readonly isFavorite: boolean;
    readonly isCompleted: boolean;

    readonly coverInitials: string;
    readonly coverTone: LibraryCoverTone;
}

export interface LibraryQuickItem {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly chapter: number;
    readonly progress: number;
    readonly coverInitials: string;
    readonly coverTone: LibraryCoverTone;
}

export interface LibraryReadingGoal {
    readonly targetChapters: number;
    readonly completedChapters: number;
    readonly remainingDays: number;
}

export interface LibraryStatistics {
    readonly total: number;
    readonly reading: number;
    readonly favorites: number;
    readonly completed: number;
}

export interface MyLibraryView {
    readonly stories: readonly LibraryStory[];
    readonly quickItems: readonly LibraryQuickItem[];
    readonly goal: LibraryReadingGoal;
}