import { AuthorDetailView } from './author-detail.models';

export abstract class AuthorDetailRepository {
  abstract getBySlug(slug: string): AuthorDetailView;
}
