import { Provider } from '@angular/core';

import { AuthorDirectoryRepository } from '../domain/author-directory.repository';
import { AuthorDirectoryMockRepository } from './author-directory-mock.repository';

export function provideAuthorDirectory(): Provider[] {
  return [
    {
      provide: AuthorDirectoryRepository,
      useClass: AuthorDirectoryMockRepository,
    },
  ];
}
