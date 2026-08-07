import { Observable } from 'rxjs';
import { HomePageData, Story } from '../domain/home.models';

export abstract class HomeRepository {
  abstract loadHome(): Observable<HomePageData>;
  abstract findStoryBySlug(slug: string): Observable<Story | null>;
  abstract searchStories(query: string, limit?: number): Observable<readonly Story[]>;
}
