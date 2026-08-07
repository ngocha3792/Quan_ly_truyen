import { Provider } from '@angular/core';

import { AuthorStudioRepository } from '../domain/author-studio.repository';
import { AuthorStudioMockRepository } from './author-studio-mock.repository';

export function provideAuthorStudio(): Provider[] {
  return [
    {
      provide: AuthorStudioRepository,
      useClass: AuthorStudioMockRepository,
    },
  ];
}
