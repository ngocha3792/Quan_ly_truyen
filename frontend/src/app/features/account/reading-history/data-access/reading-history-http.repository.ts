import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type { ReadingHistoryApiItem } from '../../../../core/http/reader-engagement-api.model';
import {
  ReadingHistoryItem,
  ReadingHistoryView,
  StoryCoverTone,
} from '../domain/reading-history.models';
import { ReadingHistoryRepository } from '../domain/reading-history.repository';

const TONES: readonly StoryCoverTone[] = ['blue', 'orange', 'silver', 'violet', 'gold', 'cyan'];

@Injectable()
export class ReadingHistoryHttpRepository implements ReadingHistoryRepository {
  private readonly api = inject(ReaderEngagementApiClient);

  getHistory(): Observable<ReadingHistoryView> {
    return this.api.listReadingHistory().pipe(
      map((entries) => {
        const history = entries
          .filter((entry) => entry.currentChapter !== null)
          .map(toHistoryItem);
        const chaptersRead = entries.reduce((total, entry) => {
          return total + Math.round((entry.progressPercent / 100) * entry.story.chapterCount);
        }, 0);

        return {
          history,
          statistics: {
            storiesRead: String(entries.length),
            chaptersRead: String(chaptersRead),
            weeklyReadingTime: '—',
            followedStories: '—',
          },
          continueReading: history.slice(0, 5).map((item) => ({
            id: item.id,
            storySlug: item.storySlug,
            title: item.title,
            chapterNumber: item.chapterNumber,
            progress: item.progress,
            coverInitials: item.coverInitials,
            coverTone: item.coverTone,
          })),
        };
      }),
    );
  }

  clearHistory(): Observable<void> {
    return this.api.clearReadingHistory();
  }
}

function toHistoryItem(entry: ReadingHistoryApiItem): ReadingHistoryItem {
  const chapter = entry.currentChapter!;
  const lastReadMinutes = minutesSince(entry.lastReadAt);
  return {
    id: entry.story.id,
    storySlug: entry.story.slug,
    title: entry.story.title,
    author: entry.story.author,
    genres: entry.story.categories,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    progress: entry.progressPercent,
    lastReadLabel: relativeLabel(lastReadMinutes),
    lastReadMinutes,
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
  if (minutes < 1) return 'Vừa đọc';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return `${Math.floor(minutes / 1440)} ngày trước`;
}

function initials(title: string): string {
  return title.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
}

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}
