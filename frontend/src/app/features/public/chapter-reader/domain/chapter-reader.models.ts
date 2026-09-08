import type { PublicComment, PublicCommentAuthor } from '../../comments';

export interface ChapterStory {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export interface ChapterNavigationItem {
  readonly number: number;
  readonly title: string;
  readonly url: string;
}

export interface ChapterDetail {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly blocks: readonly ChapterContentBlock[];
  readonly publishedAt: string;
  readonly views: number;
  readonly accessState: 'FREE' | 'ENTITLED' | 'BYPASS' | 'LOCKED';
  readonly priceCredits: string | null;
  readonly media: readonly ChapterComicMedia[];
}

export interface ChapterComicSlice {
  readonly id: string;
  readonly sliceIndex: number;
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly urls: { readonly avif: string; readonly webp: string; readonly jpeg: string };
}

export interface ChapterComicMedia {
  readonly mediaAssetId: string;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly slices: readonly ChapterComicSlice[];
}

export interface ChapterContentBlock {
  readonly id: string | null;
  readonly type: 'paragraph' | 'heading' | 'blockquote' | 'list' | 'code' | 'horizontal_rule';
  readonly text: string;
}

export type ChapterCommentAuthor = PublicCommentAuthor;

export type ChapterComment = PublicComment;

export interface TextSelectionAnchor {
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
  readonly quoteText: string;
}

export interface ComicCommentRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChapterReaderView {
  readonly story: ChapterStory;
  readonly chapter: ChapterDetail;
  readonly navigation: {
    readonly previous: ChapterNavigationItem | null;
    readonly next: ChapterNavigationItem | null;
  };
  readonly comments: readonly ChapterComment[];
  readonly totalComments: number;
}

export interface ChapterListItem {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly publishedAt: string;
}

export interface ChapterListPage {
  readonly items: readonly ChapterListItem[];
  readonly page: number;
  readonly totalPages: number;
}
