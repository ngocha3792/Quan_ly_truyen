import { Provider } from '@angular/core';

import { AuthorDirectoryRepository } from '../domain/author-directory.repository';
import { AuthorDirectoryHttpRepository } from './author-directory-http.repository';

export function provideAuthorDirectory(): Provider[] {
  return [
    {
      provide: AuthorDirectoryRepository,
      useClass: AuthorDirectoryHttpRepository,
    },
  ];
}
