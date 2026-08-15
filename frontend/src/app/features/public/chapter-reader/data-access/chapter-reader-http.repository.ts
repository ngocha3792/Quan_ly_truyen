import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import {
  PublicChapterNavigationApiItem,
  PublicChapterReaderApiResponse,
} from '../../../../core/http/public-stories-api.model';
import { ChapterNavigationItem, ChapterReaderView } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterReaderHttpRepository implements ChapterReaderRepository {
  private readonly api = inject(PublicStoriesApiClient);

  getChapter(storySlug: string, chapterNumber: string): Observable<ChapterReaderView> {
    return this.api
      .chapter(storySlug, chapterNumber)
      .pipe(map((result) => toChapterReaderView(result)));
  }
}

function toChapterReaderView(result: PublicChapterReaderApiResponse): ChapterReaderView {
  return {
    story: result.story,
    chapter: {
      id: result.chapter.id,
      number: result.chapter.number,
      title: result.chapter.title,
      paragraphs: toParagraphs(result.chapter.content),
      publishedAt: result.chapter.publishedAt,
      views: result.chapter.views,
    },
    navigation: {
      previous: toNavigation(result.story.slug, result.navigation.previous),
      next: toNavigation(result.story.slug, result.navigation.next),
    },
    comments: [],
    totalComments: result.chapter.comments,
  };
}

function toNavigation(
  storySlug: string,
  chapter: PublicChapterNavigationApiItem | null,
): ChapterNavigationItem | null {
  if (!chapter) {
    return null;
  }

  return {
    number: chapter.number,
    title: chapter.title,
    url: `/truyen/${storySlug}/chuong/${chapter.number}`,
  };
}

function toParagraphs(content: string): readonly string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
