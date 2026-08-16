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
  readonly publishedAt: string;
  readonly views: number;
}

export type ChapterCommentAuthor = PublicCommentAuthor;

export type ChapterComment = PublicComment;

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
