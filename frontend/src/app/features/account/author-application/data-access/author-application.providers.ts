import { Provider } from '@angular/core';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationApiRepository } from './author-application-api.repository';

export function provideAuthorApplication(): Provider[] {
  return [
    {
      provide: AuthorApplicationRepository,

      useClass: AuthorApplicationApiRepository,
    },
  ];
}
