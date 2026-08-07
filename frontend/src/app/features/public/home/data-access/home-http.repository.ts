import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HomePageData, Story } from '../domain/home.models';
import { HomeRepository } from './home.repository';

@Injectable()
export class HomeHttpRepository implements HomeRepository {
  private readonly http = inject(HttpClient);

  loadHome(): Observable<HomePageData> {
    return this.http.get<HomePageData>('/api/v1/home');
  }

  findStoryBySlug(slug: string): Observable<Story | null> {
    return this.http.get<Story | null>(`/api/v1/stories/${slug}`);
  }

  searchStories(query: string, limit = 6): Observable<readonly Story[]> {
    return this.http.get<readonly Story[]>(`/api/v1/stories/search`, {
      params: { q: query, limit },
    });
  }
}
