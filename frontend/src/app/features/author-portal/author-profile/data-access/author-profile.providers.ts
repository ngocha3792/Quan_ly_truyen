import { Provider } from '@angular/core';
import { AuthorProfileRepository } from '../domain/author-profile.repository';
import { AuthorProfileHttpRepository } from './author-profile-http.repository';

export function provideAuthorProfile(): Provider[] {
  return [
    AuthorProfileHttpRepository,
    { provide: AuthorProfileRepository, useExisting: AuthorProfileHttpRepository },
  ];
}
