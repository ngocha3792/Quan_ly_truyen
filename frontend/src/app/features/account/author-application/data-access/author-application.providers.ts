import { Provider } from '@angular/core';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationApiRepository } from './author-application-api.repository';

import { AuthorApplicationState } from './author-application.state';

export function provideAuthorApplication(): Provider[] {
  return [
    AuthorApplicationState,

    {
      provide: AuthorApplicationRepository,

      useClass: AuthorApplicationApiRepository,
    },
  ];
}
