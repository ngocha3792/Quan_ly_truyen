import { Provider } from '@angular/core';

import { AuthorDetailRepository } from '../domain/author-detail.repository';
import { AuthorDetailHttpRepository } from './author-detail-http.repository';

export function provideAuthorDetail(): Provider[] {
  return [
    {
      provide: AuthorDetailRepository,
      useClass: AuthorDetailHttpRepository,
    },
  ];
}
