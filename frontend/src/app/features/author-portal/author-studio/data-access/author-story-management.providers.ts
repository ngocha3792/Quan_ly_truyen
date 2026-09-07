import { Provider } from '@angular/core';

import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorMediaUploadService } from './author-media-upload.service';
import { AuthorChapterMonetizationHttpService } from './author-chapter-monetization-http.service';
import { AuthorChapterVersionHttpService } from './author-chapter-version-http.service';
import { AuthorStoryManagementHttpRepository } from './author-story-management-http.repository';

export function provideAuthorStoryManagement(): Provider[] {
  return [
    AuthorMediaUploadService,
    AuthorChapterMonetizationHttpService,
    AuthorChapterVersionHttpService,
    {
      provide: AuthorStoryManagementRepository,
      useClass: AuthorStoryManagementHttpRepository,
    },
  ];
}
