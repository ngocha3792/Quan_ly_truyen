import { Provider } from '@angular/core';

import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorStoryCoverUploadService } from './author-story-cover-upload.service';
import { AuthorStoryManagementHttpRepository } from './author-story-management-http.repository';

export function provideAuthorStoryManagement(): Provider[] {
  return [
    AuthorStoryCoverUploadService,
    {
      provide: AuthorStoryManagementRepository,
      useClass: AuthorStoryManagementHttpRepository,
    },
  ];
}
