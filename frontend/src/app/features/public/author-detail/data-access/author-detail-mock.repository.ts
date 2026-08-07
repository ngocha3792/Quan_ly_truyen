import { Injectable } from '@angular/core';

import { AuthorDetailRepository } from '../domain/author-detail.repository';
import { AuthorDetailView } from '../domain/author-detail.models';
import { AUTHOR_DETAIL_MOCK } from '../mock/author-detail.mock';

@Injectable()
export class AuthorDetailMockRepository implements AuthorDetailRepository {
  getBySlug(slug: string): AuthorDetailView {
    return {
      ...AUTHOR_DETAIL_MOCK,
      profile: {
        ...AUTHOR_DETAIL_MOCK.profile,
        slug,
      },
    };
  }
}
