import { Provider } from '@angular/core';

import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorMediaUploadService } from './author-media-upload.service';
import { AuthorStoryManagementHttpRepository } from './author-story-management-http.repository';

export function provideAuthorStoryManagement(): Provider[] {
  return [
    AuthorMediaUploadService,
    {
      provide: AuthorStoryManagementRepository,
      useClass: AuthorStoryManagementHttpRepository,
    },
  ];
}
