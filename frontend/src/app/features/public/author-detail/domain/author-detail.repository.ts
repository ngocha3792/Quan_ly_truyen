import { Observable } from 'rxjs';

import { AuthorDetailView } from './author-detail.models';

export abstract class AuthorDetailRepository {
  abstract getBySlug(slug: string): Observable<AuthorDetailView>;
}
