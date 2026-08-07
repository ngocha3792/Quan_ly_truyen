import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { HomePageData, Story } from '../domain/home.models';
import { HOME_DATA, STORIES } from '../mock/home.mock';
import { HomeRepository } from './home.repository';

@Injectable()
export class HomeMockRepository implements HomeRepository {
  loadHome(): Observable<HomePageData> {
    return of(HOME_DATA).pipe(delay(260));
  }

  findStoryBySlug(slug: string): Observable<Story | null> {
    return of(STORIES.find((story) => story.slug === slug) ?? null).pipe(delay(180));
  }

  searchStories(query: string, limit = 6): Observable<readonly Story[]> {
    const normalized = normalize(query);
    if (!normalized) return of([]);
    const results = STORIES.filter((story) => {
      const haystack = normalize(`${story.title} ${story.author} ${story.categories.join(' ')}`);
      return haystack.includes(normalized);
    }).slice(0, limit);
    return of(results);
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
