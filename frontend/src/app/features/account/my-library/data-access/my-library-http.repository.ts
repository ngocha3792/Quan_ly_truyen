import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type { LibraryEntryApiItem } from '../../../../core/http/reader-engagement-api.model';
import { LibraryCoverTone, LibraryStory, MyLibraryView } from '../domain/my-library.models';
import { MyLibraryRepository } from '../domain/my-library.repository';

const TONES: readonly LibraryCoverTone[] = [
  'blue',
  'violet',
  'orange',
  'gold',
  'cyan',
  'silver',
  'crimson',
  'indigo',
];

@Injectable()
export class MyLibraryHttpRepository implements MyLibraryRepository {
  private readonly api = inject(ReaderEngagementApiClient);

  getLibrary(): Observable<MyLibraryView> {
    return forkJoin([this.api.listLibrary(), this.api.getReadingGoal()]).pipe(
      map(([entries, goal]) => {
        const stories = entries.map(toLibraryStory);
        return {
          stories,
          quickItems: stories
            .filter((story) => story.currentChapter > 0)
            .slice(0, 5)
            .map((story) => ({
              id: story.id,
              slug: story.slug,
              title: story.title,
              chapter: story.currentChapter,
              progress: story.progress,
              coverUrl: story.coverUrl,
              coverInitials: story.coverInitials,
              coverTone: story.coverTone,
            })),
          goal,
        };
      }),
    );
  }

  setFavorite(storyId: string, isFavorite: boolean): Observable<void> {
    return this.api.upsertLibrary(storyId, { isFavorite }).pipe(map(() => undefined));
  }
}

function toLibraryStory(entry: LibraryEntryApiItem): LibraryStory {
  const lastReadMinutes = minutesSince(entry.updatedAt);
  const currentChapter = entry.lastReadChapter?.number ?? 0;
  const latestChapter = entry.story.latestChapterNumber ?? 0;
  return {
    id: entry.story.id,
    slug: entry.story.slug,
    title: entry.story.title,
    author: entry.story.author,
    genres: entry.story.categories,
    currentChapter,
    latestChapter,
    progress: entry.progressPercent,
    lastReadLabel: relativeLabel(lastReadMinutes),
    lastReadMinutes,
    isReading: entry.status === 'READING',
    isFavorite: entry.isFavorite,
    isCompleted: entry.status === 'COMPLETED',
    coverUrl: entry.story.coverUrl,
    coverInitials: initials(entry.story.title),
    coverTone: TONES[hash(entry.story.id) % TONES.length],
  };
}

function minutesSince(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
}

function relativeLabel(minutes: number): string {
  if (minutes < 1) return 'Vừa cập nhật';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return `${Math.floor(minutes / 1440)} ngày trước`;
}

function initials(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}
