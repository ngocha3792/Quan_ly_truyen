import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { HomePageData, Story } from '../../../shared/models/story.model';
import { HOME_DATA, STORIES } from './home.mock';

@Injectable({ providedIn: 'root' })
export class HomeRepository {
  loadHome(): Observable<HomePageData> {
    return of(HOME_DATA).pipe(delay(260));
  }

  findStoryBySlug(slug: string): Observable<Story | null> {
    return of(STORIES.find((story) => story.slug === slug) ?? null).pipe(delay(180));
  }

  searchStories(query: string, limit = 6): readonly Story[] {
    const normalized = normalize(query);
    if (!normalized) return [];
    return STORIES.filter((story) => {
      const haystack = normalize(`${story.title} ${story.author} ${story.categories.join(' ')}`);
      return haystack.includes(normalized);
    }).slice(0, limit);
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
