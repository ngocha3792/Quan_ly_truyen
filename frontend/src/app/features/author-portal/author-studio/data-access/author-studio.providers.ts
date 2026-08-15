import { Provider } from '@angular/core';

import { AuthorStudioRepository } from '../domain/author-studio.repository';
import { AuthorStudioHttpRepository } from './author-studio-http.repository';

export function provideAuthorStudio(): Provider[] {
  return [
    {
      provide: AuthorStudioRepository,
      useClass: AuthorStudioHttpRepository,
    },
  ];
}
